import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 [ENROLLMENT-PAYMENT] Function invoked:', req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { enrollment_id } = await req.json();

    if (!enrollment_id) {
      return new Response(JSON.stringify({ error: "enrollment_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Autenticação inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Processing enrollment payment for user: ${user.id}, enrollment: ${enrollment_id}`);

    // Get enrollment with course data
    const { data: enrollment, error: enrollmentError } = await serviceClient
      .from('enrollments')
      .select(`
        *,
        courses (
          id,
          name,
          enrollment_fee
        ),
        pre_enrollments (
          id,
          full_name,
          email,
          cpf,
          whatsapp,
          address,
          address_number,
          state,
          postal_code
        )
      `)
      .eq('id', enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      console.error("Enrollment not found:", enrollmentError);
      return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate ownership
    if (enrollment.user_id !== user.id) {
      console.error(`User ${user.id} tried to access enrollment ${enrollment_id} owned by ${enrollment.user_id}`);
      return new Response(JSON.stringify({ error: "Acesso não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if enrollment_fee is configured
    const enrollmentFee = enrollment.courses?.enrollment_fee;
    if (!enrollmentFee || enrollmentFee <= 0) {
      console.error("Enrollment fee not configured:", {
        enrollmentId: enrollment_id,
        courseName: enrollment.courses?.name,
        fee: enrollmentFee
      });
      return new Response(JSON.stringify({ 
        error: "Taxa de matrícula não configurada para este curso" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get payment settings
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from('payment_settings')
      .select('environment, asaas_api_key_sandbox, asaas_api_key_production')
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      console.error("Payment settings not found:", settingsError);
      return new Response(JSON.stringify({ 
        error: "Configurações de pagamento não encontradas" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const environment = paymentSettings.environment || 'sandbox';
    const asaasApiKey = environment === 'production' 
      ? paymentSettings.asaas_api_key_production 
      : paymentSettings.asaas_api_key_sandbox;

    if (!asaasApiKey) {
      console.error(`API key not configured for ${environment}`);
      return new Response(JSON.stringify({ 
        error: "API key não configurada" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check for existing pending payment
    const { data: existingPayment } = await serviceClient
      .from('payments')
      .select('id, asaas_payment_id, asaas_customer_id')
      .eq('enrollment_id', enrollment_id)
      .eq('kind', 'enrollment')
      .in('status', ['pending', 'waiting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.asaas_payment_id) {
      console.log('Reusing existing payment:', existingPayment.id);
      
      // Get payment details from Asaas
      const asaasBaseUrl = environment === 'production' 
        ? "https://api.asaas.com/v3" 
        : "https://sandbox.asaas.com/api/v3";
        
      const paymentResponse = await fetch(`${asaasBaseUrl}/payments/${existingPayment.asaas_payment_id}`, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "access_token": asaasApiKey
        }
      });

      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        return new Response(JSON.stringify({
          payment_id: payment.id,
          payment_status: payment.status,
          invoice_url: payment.invoiceUrl,
          bank_slip_url: payment.bankSlipUrl,
          due_date: payment.dueDate,
          value: payment.value,
          reused: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Helper functions
    const cleanPhone = (phone: string | null): string => {
      if (!phone) return "11999999999";
      const cleaned = phone.replace(/\D/g, '');
      return (cleaned.length >= 10 && cleaned.length <= 11) ? cleaned : "11999999999";
    };

    const cleanPostalCode = (code: string | null): string => {
      if (!code) return "01310200";
      const cleaned = code.replace(/\D/g, '');
      return cleaned.length === 8 ? cleaned : "01310200";
    };

    const cleanCPF = (cpf: string | null): string => {
      if (!cpf) return "00000000000";
      const cleaned = cpf.replace(/\D/g, '');
      return cleaned.length === 11 ? cleaned : "00000000000";
    };

    // Get user profile for fallback data
    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const preEnrollment = enrollment.pre_enrollments;
    const courseName = enrollment.courses?.name || 'Curso';

    const asaasBaseUrl = environment === 'production' 
      ? "https://api.asaas.com/v3" 
      : "https://sandbox.asaas.com/api/v3";

    // Step 1: Create or get customer in Asaas
    const customerData = {
      name: preEnrollment?.full_name || userProfile?.full_name || "Nome não informado",
      cpfCnpj: cleanCPF(preEnrollment?.cpf || userProfile?.cpf),
      email: preEnrollment?.email || userProfile?.email || user.email || "email@exemplo.com",
      phone: cleanPhone(preEnrollment?.whatsapp || userProfile?.whatsapp),
      mobilePhone: cleanPhone(preEnrollment?.whatsapp || userProfile?.whatsapp),
      address: preEnrollment?.address || userProfile?.address || "Rua não informada",
      addressNumber: preEnrollment?.address_number || userProfile?.address_number || "S/N",
      province: preEnrollment?.state || userProfile?.state || "SP",
      postalCode: cleanPostalCode(preEnrollment?.postal_code || userProfile?.postal_code)
    };

    console.log('Creating Asaas customer:', { environment, cpf: customerData.cpfCnpj });

    const customerResponse = await fetch(`${asaasBaseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey
      },
      body: JSON.stringify(customerData)
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error("Asaas customer creation error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao criar cliente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const customer = await customerResponse.json();
    console.log('Asaas customer created:', customer.id);

    // Step 2: Create payment using /v3/lean/payments
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days from now
    
    const paymentData = {
      customer: customer.id,
      billingType: "UNDEFINED", // Permite PIX, BOLETO e CREDIT_CARD
      value: enrollmentFee,
      dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
      description: `Matrícula - ${courseName}`,
      externalReference: enrollment_id
    };

    console.log('Creating Asaas payment:', { environment, enrollmentFee, courseName });

    const paymentResponse = await fetch(`${asaasBaseUrl}/lean/payments`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
        "access_token": asaasApiKey
      },
      body: JSON.stringify(paymentData)
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Asaas payment creation error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao criar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payment = await paymentResponse.json();
    console.log('Asaas payment created:', payment.id);

    // Store payment in database
    try {
      const { data: newPayment, error: paymentError } = await serviceClient
        .from('payments')
        .insert({
          pre_enrollment_id: preEnrollment?.id,
          enrollment_id: enrollment_id,
          amount: enrollmentFee,
          currency: 'BRL',
          status: 'pending',
          kind: 'enrollment',
          asaas_payment_id: payment.id,
          asaas_customer_id: customer.id
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error storing payment:", paymentError);
      } else {
        console.log("Payment record created:", newPayment.id);
        
        // Update enrollment with payment reference
        await serviceClient
          .from('enrollments')
          .update({ enrollment_payment_id: payment.id })
          .eq('id', enrollment_id);
      }
    } catch (error) {
      console.error("Exception storing payment:", error);
    }

    return new Response(JSON.stringify({
      payment_id: payment.id,
      payment_status: payment.status,
      invoice_url: payment.invoiceUrl,
      bank_slip_url: payment.bankSlipUrl,
      due_date: payment.dueDate,
      value: payment.value
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});