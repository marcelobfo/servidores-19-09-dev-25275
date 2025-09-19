import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

// Helper function to trigger N8N webhook
const triggerN8NWebhook = async (supabaseClient: any, enrollmentId: string, eventType: string) => {
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

    // Get enrollment details
    const { data: enrollment } = await supabaseClient
      .from('pre_enrollments')
      .select(`
        *,
        course:courses(name)
      `)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      console.error('Enrollment not found:', enrollmentId);
      return;
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      enrollment: {
        id: enrollment.id,
        student_name: enrollment.full_name,
        student_email: enrollment.email,
        student_phone: enrollment.phone || enrollment.whatsapp,
        course_name: enrollment.course?.name || 'Unknown Course',
        status: enrollment.status,
        created_at: enrollment.created_at,
        updated_at: enrollment.updated_at,
      },
    };

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

    const webhookData = await req.json();
    
    console.log('Received webhook:', JSON.stringify(webhookData, null, 2));

    const { event, payment } = webhookData;

    if (!payment?.id) {
      console.log('No payment ID in webhook');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Find payment in our database
    const { data: dbPayment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*, pre_enrollments(*)')
      .eq('asaas_payment_id', payment.id)
      .single();

    if (paymentError) {
      console.error('Payment not found:', paymentError);
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

    // Update pre-enrollment status if payment was received/confirmed
    if (updatePreEnrollmentStatus) {
      const { error: updatePreEnrollmentError } = await supabaseClient
        .from('pre_enrollments')
        .update({ status: 'payment_confirmed' })
        .eq('id', dbPayment.pre_enrollment_id);

      if (updatePreEnrollmentError) {
        console.error('Error updating pre-enrollment:', updatePreEnrollmentError);
        // Don't throw here as payment update was successful
      } else {
        console.log('Pre-enrollment status updated to payment_confirmed');
        
        // Trigger N8N webhook for payment confirmation
        await triggerN8NWebhook(supabaseClient, dbPayment.pre_enrollment_id, 'payment_confirmed');
      }
    }

    console.log('Webhook processed successfully');

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error in webhook-asaas function:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});