import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

// Helper function to trigger N8N webhook with enriched data
const triggerN8NWebhook = async (
  supabaseClient: any, 
  enrollmentId: string, 
  eventType: string,
  paymentId?: string
) => {
  try {
    // Get system settings to check if webhook is configured
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('n8n_webhook_url, webhook_events')
      .single();

    if (!settings?.n8n_webhook_url || !settings?.webhook_events?.includes(eventType)) {
      console.log('N8N webhook not configured or event not enabled:', eventType);
      return;
    }

    // Get FULL enrollment details including all student data
    const { data: enrollment } = await supabaseClient
      .from('pre_enrollments')
      .select(`
        *,
        course:courses(id, name, duration_hours)
      `)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      console.error('Enrollment not found:', enrollmentId);
      return;
    }

    // Fetch payment data if paymentId is provided
    let paymentData = null;
    if (paymentId) {
      const { data: payment } = await supabaseClient
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (payment) {
        paymentData = {
          id: payment.id,
          asaas_payment_id: payment.asaas_payment_id,
          amount: payment.amount,
          currency: payment.currency,
          billing_type: payment.billing_type || null,
          status: payment.status,
          paid_at: payment.paid_at,
          pix_qr_code: payment.pix_qr_code,
          pix_payload: payment.pix_payload,
          pix_expiration_date: payment.pix_expiration_date,
          created_at: payment.created_at,
        };
      }
    }

    // Build enriched payload with all student and course data
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      enrollment: {
        id: enrollment.id,
        // Student personal data
        student_name: enrollment.full_name,
        student_email: enrollment.email,
        student_phone: enrollment.phone || null,
        student_whatsapp: enrollment.whatsapp || null,
        student_cpf: enrollment.cpf || null,
        student_birth_date: enrollment.birth_date || null,
        // Organization
        organization: enrollment.organization || null,
        // Address data
        address: enrollment.address || null,
        address_number: enrollment.address_number || null,
        complement: enrollment.complement || null,
        city: enrollment.city || null,
        state: enrollment.state || null,
        postal_code: enrollment.postal_code || null,
        // Course data
        course_id: enrollment.course?.id || enrollment.course_id || null,
        course_name: enrollment.course?.name || 'Unknown Course',
        course_hours: enrollment.custom_hours || enrollment.course?.duration_hours || null,
        // License dates
        license_start_date: enrollment.license_start_date || null,
        license_end_date: enrollment.license_end_date || null,
        license_duration: enrollment.license_duration || null,
        // Status and timestamps
        status: enrollment.status,
        created_at: enrollment.created_at,
        updated_at: enrollment.updated_at,
        additional_info: enrollment.additional_info || null,
      },
      ...(paymentData && { payment: paymentData }),
    };

    console.log('📤 Triggering N8N webhook with enriched data:', {
      event: eventType,
      enrollment_id: enrollmentId,
      has_payment: !!paymentData,
      student_name: enrollment.full_name,
      student_cpf: enrollment.cpf ? '***' : null,
      course_name: enrollment.course?.name
    });

    const response = await fetch(settings.n8n_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const success = response.ok;
    const responseText = await response.text();

    // Log the webhook attempt
    await supabaseClient.from('webhook_logs').insert({
      webhook_url: settings.n8n_webhook_url,
      event_type: eventType,
      payload: payload,
      response_status: response.status,
      response_body: responseText,
      success: success,
      enrollment_id: enrollmentId,
    });

    console.log('N8N webhook triggered:', success ? 'success' : 'failed');
  } catch (error) {
    console.error('Error triggering N8N webhook:', error);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch stored webhook token from payment_settings
    const { data: settings } = await supabaseClient
      .from('payment_settings')
      .select('asaas_webhook_token')
      .maybeSingle();

    const webhookToken = req.headers.get('asaas-access-token');
    const storedToken = settings?.asaas_webhook_token;

    // SECURITY: Validate webhook token only if configured in database
    if (storedToken && storedToken.trim() !== '') {
      if (!webhookToken) {
        console.error('❌ Missing Asaas webhook token - token is required because it is configured in payment_settings');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Missing webhook token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (webhookToken !== storedToken) {
        console.error('❌ Invalid Asaas webhook token - token does not match configured value');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid webhook token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ Webhook authenticated with valid token');
    } else {
      // Token not configured - accept webhook but log security warning
      console.warn('⚠️ SECURITY WARNING: Webhook token not configured in payment_settings. Accepting webhook without authentication.');
      console.warn('⚠️ Para segurança máxima, configure "Token do Webhook" em Configurações de Pagamento e no painel do Asaas.');
    }

    const webhookData = await req.json();
    
    console.log('Received authenticated webhook:', JSON.stringify(webhookData, null, 2));

    const { event, payment } = webhookData;

    if (!payment?.id) {
      console.log('No payment ID in webhook');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    console.log('🔍 Buscando pagamento:', {
      asaas_payment_id: payment.id,
      externalReference: payment.externalReference
    });

    // Find payment in our database - first try by asaas_payment_id
    let dbPayment = null;
    let paymentError = null;

    const { data: paymentByAsaasId, error: errorByAsaasId } = await supabaseClient
      .from('payments')
      .select('*, pre_enrollments(*)')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (paymentByAsaasId) {
      dbPayment = paymentByAsaasId;
      console.log('✅ Pagamento encontrado por asaas_payment_id');
    } else if (payment.externalReference) {
      // Try to find by externalReference (could be enrollment_id or pre_enrollment_id)
      console.log('🔍 Tentando buscar por externalReference:', payment.externalReference);
      
      // First try as enrollment_id
      const { data: paymentByEnrollmentId, error: errorByEnrollmentId } = await supabaseClient
        .from('payments')
        .select('*, pre_enrollments(*)')
        .eq('enrollment_id', payment.externalReference)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentByEnrollmentId) {
        dbPayment = paymentByEnrollmentId;
        console.log('✅ Pagamento encontrado por enrollment_id');
      } else {
        // Try as pre_enrollment_id
        const { data: paymentByPreEnrollmentId, error: errorByPreEnrollmentId } = await supabaseClient
          .from('payments')
          .select('*, pre_enrollments(*)')
          .eq('pre_enrollment_id', payment.externalReference)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentByPreEnrollmentId) {
          dbPayment = paymentByPreEnrollmentId;
          console.log('✅ Pagamento encontrado por pre_enrollment_id');
        }
      }
    }

    if (!dbPayment) {
      console.error('❌ Pagamento não encontrado no banco:', {
        asaas_payment_id: payment.id,
        externalReference: payment.externalReference
      });
      return new Response('Payment not found', { status: 404, headers: corsHeaders });
    }

    console.log('Found payment in database:', dbPayment.id);

    let newStatus = dbPayment.status;
    let updatePreEnrollmentStatus = false;

    // Update payment status based on webhook event
    switch (event) {
      case 'PAYMENT_RECEIVED':
        newStatus = 'received';
        updatePreEnrollmentStatus = true;
        console.log('Payment received for:', payment.id);
        break;
      case 'PAYMENT_CONFIRMED':
        newStatus = 'confirmed';
        updatePreEnrollmentStatus = true;
        console.log('Payment confirmed for:', payment.id);
        break;
      case 'PAYMENT_OVERDUE':
        newStatus = 'overdue';
        console.log('Payment overdue for:', payment.id);
        break;
      case 'PAYMENT_REFUNDED':
        newStatus = 'refunded';
        console.log('Payment refunded for:', payment.id);
        break;
      default:
        console.log('Unhandled webhook event:', event);
        return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Update payment status
    const { error: updatePaymentError } = await supabaseClient
      .from('payments')
      .update({ 
        status: newStatus,
        paid_at: (newStatus === 'received' || newStatus === 'confirmed') ? new Date().toISOString() : null
      })
      .eq('id', dbPayment.id);

    if (updatePaymentError) {
      console.error('Error updating payment:', updatePaymentError);
      throw new Error('Failed to update payment');
    }

    // Check if this is an enrollment payment
    const isEnrollmentPayment = dbPayment.kind === 'enrollment';
    console.log('📋 Tipo de pagamento:', {
      kind: dbPayment.kind,
      isEnrollmentPayment,
      enrollment_id: dbPayment.enrollment_id,
      pre_enrollment_id: dbPayment.pre_enrollment_id
    });

    // Update pre-enrollment status if payment was received/confirmed (for pre-enrollment payments)
    if (updatePreEnrollmentStatus && !isEnrollmentPayment && dbPayment.pre_enrollment_id) {
      const { error: updatePreEnrollmentError } = await supabaseClient
        .from('pre_enrollments')
        .update({ status: 'payment_confirmed' })
        .eq('id', dbPayment.pre_enrollment_id);

      if (updatePreEnrollmentError) {
        console.error('❌ Erro ao atualizar pre-enrollment:', updatePreEnrollmentError);
        // Don't throw here as payment update was successful
      } else {
        console.log('✅ Pre-enrollment status updated to payment_confirmed');
        
        // Trigger N8N webhook for payment confirmation with enriched data
        await triggerN8NWebhook(supabaseClient, dbPayment.pre_enrollment_id, 'payment_confirmed', dbPayment.id);
      }
    }

    // Update enrollment status if this is an enrollment payment
    if (updatePreEnrollmentStatus && isEnrollmentPayment && dbPayment.enrollment_id) {
      console.log('🎓 Atualizando matrícula:', dbPayment.enrollment_id);
      
      const { error: updateEnrollmentError } = await supabaseClient
        .from('enrollments')
        .update({
          payment_status: 'paid',
          status: 'active',
          enrollment_date: new Date().toISOString()
        })
        .eq('id', dbPayment.enrollment_id);

      if (updateEnrollmentError) {
        console.error('❌ Erro ao atualizar matrícula:', updateEnrollmentError);
        // Don't throw here as payment update was successful
      } else {
        console.log('✅ Matrícula atualizada para active com payment_status paid');
      }
    }

    // If we have externalReference that matches enrollment pattern, also try direct update
    if (updatePreEnrollmentStatus && payment.externalReference) {
      // Check if the externalReference is an enrollment ID directly
      const { data: enrollment } = await supabaseClient
        .from('enrollments')
        .select('id, status, payment_status')
        .eq('id', payment.externalReference)
        .maybeSingle();

      if (enrollment && enrollment.payment_status !== 'paid') {
        console.log('🔄 Atualizando matrícula via externalReference:', payment.externalReference);
        
        const { error: directUpdateError } = await supabaseClient
          .from('enrollments')
          .update({
            payment_status: 'paid',
            status: 'active',
            enrollment_date: new Date().toISOString()
          })
          .eq('id', payment.externalReference);

        if (directUpdateError) {
          console.error('❌ Erro ao atualizar matrícula diretamente:', directUpdateError);
        } else {
          console.log('✅ Matrícula atualizada diretamente via externalReference');
        }
      }
    }

    console.log('✅ Webhook processado com sucesso');

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Erro no webhook-asaas:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
