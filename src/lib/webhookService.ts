import { supabase } from "@/integrations/supabase/client";

interface WebhookPayload {
  event: string;
  timestamp: string;
  enrollment: {
    id: string;
    student_name: string;
    student_email: string;
    student_phone?: string;
    course_name: string;
    status: string;
    previous_status?: string;
    created_at: string;
    updated_at: string;
  };
}

export const sendWebhook = async (
  webhookUrl: string,
  payload: WebhookPayload,
  enrollmentId: string
): Promise<boolean> => {
  try {
    console.log('Sending webhook to:', webhookUrl, 'Payload:', payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const success = response.ok;

    // Log the webhook attempt
    await supabase.from('webhook_logs').insert({
      webhook_url: webhookUrl,
      event_type: payload.event,
      payload: payload as any,
      response_status: response.status,
      response_body: responseText,
      success: success,
      enrollment_id: enrollmentId,
    });

    return success;
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Log the failed attempt
    await supabase.from('webhook_logs').insert({
      webhook_url: webhookUrl,
      event_type: payload.event,
      payload: payload as any,
      response_status: 0,
      response_body: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      enrollment_id: enrollmentId,
    });

    return false;
  }
};

export const triggerEnrollmentWebhook = async (
  enrollmentId: string,
  eventType: 'enrollment_created' | 'payment_confirmed' | 'enrollment_approved' | 'status_changed',
  previousStatus?: string
) => {
  try {
    // Get system settings to check if webhook is configured
    const { data: settings } = await supabase
      .from('system_settings')
      .select('n8n_webhook_url, webhook_events')
      .single();

    if (!settings?.n8n_webhook_url || !settings?.webhook_events?.includes(eventType)) {
      console.log('Webhook not configured or event not enabled:', eventType);
      return;
    }

    // Get enrollment details
    const { data: enrollment } = await supabase
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

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      enrollment: {
        id: enrollment.id,
        student_name: enrollment.full_name,
        student_email: enrollment.email,
        student_phone: enrollment.phone || enrollment.whatsapp,
        course_name: enrollment.course?.name || 'Unknown Course',
        status: enrollment.status,
        previous_status: previousStatus,
        created_at: enrollment.created_at,
        updated_at: enrollment.updated_at,
      },
    };

    await sendWebhook(settings.n8n_webhook_url, payload, enrollmentId);
  } catch (error) {
    console.error('Error triggering enrollment webhook:', error);
  }
};

export const testWebhook = async (webhookUrl: string): Promise<{ success: boolean; message: string }> => {
  try {
    const testPayload: WebhookPayload = {
      event: 'webhook_test',
      timestamp: new Date().toISOString(),
      enrollment: {
        id: 'test-id',
        student_name: 'Teste Webhook',
        student_email: 'teste@exemplo.com',
        course_name: 'Curso de Teste',
        status: 'test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    if (response.ok) {
      return { success: true, message: 'Webhook testado com sucesso!' };
    } else {
      return { success: false, message: `Erro HTTP: ${response.status}` };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
};