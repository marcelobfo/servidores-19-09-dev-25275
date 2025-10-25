import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CREATE PAYMENT v2.1 - EXPIRATION AUTO-CANCEL ACTIVE ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Helper function to clean CPF
    const cleanCPF = (cpf: string | null): string | null => {
      if (!cpf) return null;
      return cpf.replace(/[^\d]/g, '');
    };

    // Helper function to validate phone
    const getValidPhone = (phone: string | null, whatsapp: string | null): string | null => {
      if (phone && phone.trim() !== '') return phone;
      if (whatsapp && whatsapp.trim() !== '') return whatsapp;
      return null;
    };

    // Helper function to truncate name to Asaas limit (max 30 characters)
    const truncateName = (name: string, maxLength: number = 30): string => {
      const trimmed = name.trim();
      if (trimmed.length <= maxLength) return trimmed;
      return trimmed.substring(0, maxLength); // SEM "..." para não exceder limite
    };

    // Validate request has body
    const contentLength = req.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      throw new Error('Request body is empty');
    }

    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('Request body text:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        throw new Error('Request body is empty or invalid');
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('Parsed request body:', requestBody);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid JSON';
      throw new Error(`Invalid JSON in request body: ${errorMessage}`);
    }

    const { pre_enrollment_id, amount, kind = 'pre_enrollment', enrollment_id } = requestBody;

    // Debug endpoint - temporary
    if (requestBody?.debug === true) {
      console.log('Debug endpoint called');
      return new Response(JSON.stringify({
        version: 'v2.1',
        timestamp: new Date().toISOString(),
        message: 'Edge function with AUTO-CANCEL expired payments is ACTIVE',
        features: ['expiration_check', 'auto_cancel_expired', 'qr_code_regeneration']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: Validate required fields and types
    if (!pre_enrollment_id || typeof pre_enrollment_id !== 'string') {
      throw new Error('Campo obrigatório: pre_enrollment_id (string UUID)');
    }
    
    // Validate kind parameter
    if (kind !== 'pre_enrollment' && kind !== 'enrollment') {
      throw new Error('Campo kind inválido. Deve ser "pre_enrollment" ou "enrollment"');
    }

    // Check for duplicate payment attempts (idempotency)
    console.log('Checking for existing payments...', { pre_enrollment_id, kind });
    
    const { data: existingPayment } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('pre_enrollment_id', pre_enrollment_id)
      .eq('kind', kind)
      .in('status', ['pending', 'received', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Existing payment check result:', {
      found: !!existingPayment,
      payment_id: existingPayment?.id,
      status: existingPayment?.status,
      has_qr_code: !!existingPayment?.pix_qr_code,
      has_payload: !!existingPayment?.pix_payload,
      expiration_date: existingPayment?.pix_expiration_date
    });

    if (existingPayment) {
      console.log('Processing existing payment...', { status: existingPayment.status });
      
      // If payment is confirmed or received, block duplicate
      if (existingPayment.status === 'confirmed' || existingPayment.status === 'received') {
        console.log('Blocking duplicate - payment already confirmed/received');
        throw new Error('Já existe um pagamento confirmado para esta matrícula');
      }

      // If payment is pending, check expiration
      if (existingPayment.status === 'pending') {
        const expirationDate = existingPayment.pix_expiration_date 
          ? new Date(existingPayment.pix_expiration_date) 
          : null;
        
        const now = new Date();
        
        console.log('Checking payment expiration:', {
          expiration_date: expirationDate?.toISOString(),
          current_time: now.toISOString(),
          is_expired: expirationDate ? expirationDate <= now : 'NO_EXPIRATION_DATE',
          has_qr_code: !!existingPayment.pix_qr_code,
          has_payload: !!existingPayment.pix_payload
        });

        // If payment hasn't expired and has QR code, return existing payment
        if (expirationDate && expirationDate > now && existingPayment.pix_qr_code && existingPayment.pix_payload) {
          console.log('✅ Returning existing VALID payment - not expired, has QR code');
          return new Response(JSON.stringify({
            ...existingPayment,
            isExisting: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // If payment expired or has no QR code, cancel it and create new one
        console.log('⚠️ Payment is EXPIRED or INVALID - auto-cancelling and creating new one');
        console.log('Cancellation reason:', {
          expired: expirationDate ? expirationDate <= now : false,
          no_expiration_date: !expirationDate,
          missing_qr_code: !existingPayment.pix_qr_code,
          missing_payload: !existingPayment.pix_payload
        });
        
        const { error: cancelError } = await supabaseClient
          .from('payments')
          .update({ 
            status: 'overdue',
            error_message: 'Pagamento expirado - novo pagamento criado automaticamente'
          })
          .eq('id', existingPayment.id);

        if (cancelError) {
          console.error('❌ Error cancelling expired payment:', cancelError);
          // Continue anyway to create new payment
        } else {
          console.log('✅ Expired payment cancelled successfully');
        }
        
        console.log('▶️ Proceeding to create new payment...');
      }
    }
    
    console.log('Creating payment', { pre_enrollment_id, amount, kind, enrollment_id });

    // Get payment settings
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from('payment_settings')
      .select('*')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching payment settings:', settingsError);
      throw new Error('Erro ao buscar configurações de pagamento');
    }

    if (!paymentSettings) {
      throw new Error('Configurações de pagamento não encontradas. Configure no painel administrativo.');
    }

    // Select correct API key based on environment
    const apiKey = paymentSettings.environment === 'production'
      ? paymentSettings.asaas_api_key_production
      : paymentSettings.asaas_api_key_sandbox;

    if (!apiKey) {
      throw new Error(`Chave API do Asaas não configurada para ambiente ${paymentSettings.environment}. Configure no painel administrativo.`);
    }

    if (!paymentSettings.enabled) {
      throw new Error('Sistema de pagamentos está desabilitado.');
    }

    console.log('Payment settings loaded:', { enabled: paymentSettings.enabled });

    // Get pre-enrollment data
    const { data: preEnrollment, error: enrollmentError } = await supabaseClient
      .from('pre_enrollments')
      .select(`
        *,
        courses (
          name,
          asaas_title,
          price,
          pre_enrollment_fee,
          enrollment_fee
        )
      `)
      .eq('id', pre_enrollment_id)
      .single();

    if (enrollmentError) {
      console.error('Error fetching pre-enrollment:', enrollmentError);
      throw new Error('Pré-matrícula não encontrada');
    }

    if (!preEnrollment) {
      throw new Error('Dados da pré-matrícula não encontrados');
    }

    // Validate pre-enrollment data
    if (!preEnrollment.full_name || !preEnrollment.email) {
      throw new Error('Dados obrigatórios da pré-matrícula estão faltando (nome ou email)');
    }

    console.log('Pre-enrollment data:', preEnrollment);

    // Determine the correct amount based on payment kind and course fees
    let finalAmount = amount; // fallback to provided amount
    
    if (kind === 'pre_enrollment' && preEnrollment.courses?.pre_enrollment_fee) {
      finalAmount = Number(preEnrollment.courses.pre_enrollment_fee);
    } else if (kind === 'enrollment' && preEnrollment.courses?.enrollment_fee) {
      finalAmount = Number(preEnrollment.courses.enrollment_fee);
    }

    // Validate final amount
    if (!finalAmount || finalAmount <= 0) {
      const paymentType = kind === 'pre_enrollment' ? 'pré-matrícula' : 'matrícula';
      throw new Error(`Valor inválido para ${paymentType}. Configure o valor no curso.`);
    }

    // Minimum amount validation (Asaas requires at least R$ 5.00)
    if (finalAmount < 5) {
      throw new Error("Valor mínimo para pagamento é R$ 5,00");
    }

    console.log('Final amount determined:', { kind, finalAmount, courseFees: preEnrollment.courses });

    // SECURITY: Validate the payment amount matches the expected course fee
    const expectedAmount = kind === 'pre_enrollment' 
      ? preEnrollment.courses?.pre_enrollment_fee 
      : preEnrollment.courses?.enrollment_fee;

    if (expectedAmount && Math.abs(Number(expectedAmount) - finalAmount) > 0.01) {
      console.error('Payment amount mismatch:', { 
        expected: expectedAmount, 
        received: finalAmount 
      });
      throw new Error('Valor do pagamento não corresponde à taxa do curso');
    }

    // Prepare customer data with validation and cleaning
    const cleanedCPF = cleanCPF(preEnrollment.cpf);
    const validPhone = getValidPhone(preEnrollment.phone, preEnrollment.whatsapp);

    if (!cleanedCPF) {
      throw new Error('CPF é obrigatório para criar o pagamento');
    }

    if (cleanedCPF.length !== 11) {
      throw new Error('CPF deve ter 11 dígitos');
    }

    const customerData = {
      name: truncateName(preEnrollment.full_name.trim()),
      email: preEnrollment.email.trim(),
      cpfCnpj: cleanedCPF,
      ...(validPhone && { phone: validPhone })
    };

    // ✅ VALIDAÇÃO CRÍTICA - Garantir que customerData.name NUNCA exceda 30 caracteres
    console.log('=== VALIDAÇÃO CUSTOMERDATA ===');
    console.log('customerData.name:', customerData.name, '| Length:', customerData.name.length);
    console.log('customerData.email:', customerData.email, '| Length:', customerData.email.length);
    console.log('customerData.cpfCnpj:', customerData.cpfCnpj, '| Length:', customerData.cpfCnpj.length);
    if (customerData.phone) {
      console.log('customerData.phone:', customerData.phone, '| Length:', customerData.phone.length);
    }

    // Garantir que name NUNCA exceda 30 caracteres
    if (customerData.name.length > 30) {
      console.error('❌ CRÍTICO: customerData.name excede 30 chars, truncando...');
      customerData.name = customerData.name.substring(0, 30);
      console.log('✅ customerData.name corrigido para:', customerData.name);
    }
    console.log('==============================');

    console.log('Creating customer with data:', customerData);

    console.log('Making request to Asaas API - Create Customer');
    const customerResponse = await fetch('https://api.asaas.com/v3/customers', {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });

    console.log('Customer response status:', customerResponse.status);
    console.log('Customer response headers:', Object.fromEntries(customerResponse.headers.entries()));
    
    let customer;
    try {
      const customerResponseText = await customerResponse.text();
      console.log('Customer response body text:', customerResponseText);
      
      if (!customerResponseText || customerResponseText.trim() === '') {
        throw new Error('Empty response from Asaas customer API');
      }
      
      customer = JSON.parse(customerResponseText);
      console.log('Parsed customer response:', customer);
    } catch (parseError) {
      console.error('Error parsing customer response:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      throw new Error(`Failed to parse customer API response: ${errorMessage}`);
    }
    
    if (!customerResponse.ok) {
      console.error('Asaas customer creation error:', {
        status: customerResponse.status,
        statusText: customerResponse.statusText,
        response: customer
      });
      const errorMessage = customer.errors?.[0]?.description || 
        customer.message || 
        `Customer creation failed (${customerResponse.status})`;
      throw new Error(errorMessage);
    }

    console.log('Customer created:', customer.id);

    // Create payment in Asaas - SEMPRE usar nome fixo curto
    const courseName = 'Licenca Capacitacao'; // Fixo - 20 caracteres
    const paymentData = {
      customer: customer.id,
      billingType: 'PIX',
      value: parseFloat(finalAmount.toString()),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      description: 'Pagamento curso', // Fixo - 15 caracteres
      postalService: false
    };

    // ✅ VALIDAÇÃO PAYMENTDATA
    console.log('=== VALIDAÇÃO PAYMENTDATA ===');
    console.log('description:', paymentData.description, '| Length:', paymentData.description.length);
    console.log('value:', paymentData.value);
    console.log('dueDate:', paymentData.dueDate);
    console.log('==============================');

    console.log('Creating payment with data:', paymentData);

    console.log('Making request to Asaas API - Create Payment');
    const paymentResponse = await fetch('https://api.asaas.com/v3/payments', {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    console.log('Payment response status:', paymentResponse.status);
    console.log('Payment response headers:', Object.fromEntries(paymentResponse.headers.entries()));
    
    let payment;
    try {
      const paymentResponseText = await paymentResponse.text();
      console.log('Payment response body text:', paymentResponseText);
      
      if (!paymentResponseText || paymentResponseText.trim() === '') {
        throw new Error('Empty response from Asaas payment API');
      }
      
      payment = JSON.parse(paymentResponseText);
      console.log('Parsed payment response:', payment);
    } catch (parseError) {
      console.error('Error parsing payment response:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      throw new Error(`Failed to parse payment API response: ${errorMessage}`);
    }
    
    if (!paymentResponse.ok) {
      console.error('Asaas payment creation error:', {
        status: paymentResponse.status,
        statusText: paymentResponse.statusText,
        response: payment
      });
      const errorMessage = payment.errors?.[0]?.description || 
        payment.message || 
        `Payment creation failed (${paymentResponse.status})`;
      throw new Error(errorMessage);
    }

    console.log('Payment created:', payment.id);

    // Wait 2 seconds for Asaas to generate QR Code
    console.log('Waiting 2 seconds for QR Code generation...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get PIX QR Code
    console.log('Making request to Asaas API - Get PIX QR Code for payment:', payment.id);
    
    const qrCodeResponse = await fetch(`https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`, {
      headers: {
        'access_token': apiKey,
      },
    });

    console.log('QR Code response status:', qrCodeResponse.status);
    console.log('QR Code response headers:', Object.fromEntries(qrCodeResponse.headers.entries()));
    
    let qrCodeData;
    try {
      const qrCodeResponseText = await qrCodeResponse.text();
      console.log('QR Code response body text:', qrCodeResponseText);
      
      if (!qrCodeResponseText || qrCodeResponseText.trim() === '') {
        throw new Error('Empty response from Asaas QR code API');
      }
      
      qrCodeData = JSON.parse(qrCodeResponseText);
      console.log('Parsed QR Code response:', qrCodeData);
    } catch (parseError) {
      console.error('Error parsing QR Code response:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      throw new Error(`Failed to parse QR code API response: ${errorMessage}`);
    }
    
    if (!qrCodeResponse.ok) {
      console.error('Asaas QR code error - saving payment without QR code:', {
        status: qrCodeResponse.status,
        statusText: qrCodeResponse.statusText,
        response: qrCodeData
      });
      
      // Save payment without QR code - user can try again
      const { data: dbPayment, error: dbError } = await supabaseClient
        .from('payments')
        .insert({
          pre_enrollment_id,
          enrollment_id: enrollment_id || null,
          kind,
          asaas_payment_id: payment.id,
          amount: finalAmount,
          status: 'pending',
          error_message: 'QR Code não gerado automaticamente. Entre em contato com o suporte.',
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save payment');
      }

      // Update pre-enrollment status
      await supabaseClient
        .from('pre_enrollments')
        .update({ status: 'pending_payment' })
        .eq('id', pre_enrollment_id);

      return new Response(JSON.stringify({ 
        ...dbPayment,
        error: 'QR Code não pôde ser gerado. Por favor, atualize a página ou entre em contato com o suporte.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('QR Code generated for payment:', payment.id);

    // Save payment to database with QR code
    const { data: dbPayment, error: dbError } = await supabaseClient
      .from('payments')
      .insert({
        pre_enrollment_id,
        enrollment_id: enrollment_id || null,
        kind,
        asaas_payment_id: payment.id,
        amount: finalAmount,
        status: 'pending',
        pix_qr_code: qrCodeData.encodedImage,
        pix_payload: qrCodeData.payload,
        pix_expiration_date: qrCodeData.expirationDate,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save payment');
    }

    // Update pre-enrollment status
    const { error: updateError } = await supabaseClient
      .from('pre_enrollments')
      .update({ status: 'pending_payment' })
      .eq('id', pre_enrollment_id);

    if (updateError) {
      console.error('Error updating pre-enrollment status:', updateError);
      // Don't throw here as payment was created successfully
    }

    // If this is an enrollment payment, update enrollment with payment_id
    if (kind === 'enrollment' && enrollment_id) {
      const { error: enrollmentUpdateError } = await supabaseClient
        .from('enrollments')
        .update({ 
          enrollment_payment_id: dbPayment.id,
          status: 'pending_payment'
        })
        .eq('id', enrollment_id);

      if (enrollmentUpdateError) {
        console.error('Error linking payment to enrollment:', enrollmentUpdateError);
        // Don't throw here as payment was created successfully
      } else {
        console.log('Enrollment updated with payment_id:', dbPayment.id);
      }
    }

    console.log('Payment created successfully:', dbPayment.id);

    return new Response(JSON.stringify(dbPayment), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-payment function:', error);
    
    // Ensure we always return valid JSON
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorResponse = { 
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'Unknown error'
    };
    
    console.log('Returning error response:', errorResponse);
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});