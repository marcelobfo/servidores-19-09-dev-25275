import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking certificate availability...');

    // Get all active enrollments with their course duration
    const { data: enrollments, error: enrollmentsError } = await supabaseClient
      .from('enrollments')
      .select(`
        id,
        user_id,
        course_id,
        enrollment_date,
        certificate_notified,
        courses!inner (
          id,
          name,
          duration_days
        ),
        pre_enrollments!inner (
          full_name,
          email
        )
      `)
      .eq('status', 'active')
      .not('enrollment_date', 'is', null);

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError);
      throw enrollmentsError;
    }

    console.log(`Found ${enrollments?.length || 0} active enrollments`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notificationsToSend = [];

    for (const enrollment of enrollments || []) {
      // Skip if already notified
      if (enrollment.certificate_notified) {
        continue;
      }

      // Get course and pre_enrollment data (arrays from Supabase)
      const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
      const preEnrollment = Array.isArray(enrollment.pre_enrollments) ? enrollment.pre_enrollments[0] : enrollment.pre_enrollments;

      // Skip if no duration days
      if (!course?.duration_days || !enrollment.enrollment_date) {
        continue;
      }

      // Calculate certificate availability date
      const enrollmentDate = new Date(enrollment.enrollment_date);
      enrollmentDate.setHours(0, 0, 0, 0);
      
      const availableDate = new Date(enrollmentDate);
      availableDate.setDate(availableDate.getDate() + course.duration_days + 1);

      // Check if certificate is available
      if (today >= availableDate) {
        console.log(`Certificate available for enrollment ${enrollment.id}`);
        notificationsToSend.push({ ...enrollment, course, preEnrollment });

        // Mark as notified
        const { error: updateError } = await supabaseClient
          .from('enrollments')
          .update({ 
            certificate_notified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', enrollment.id);

        if (updateError) {
          console.error(`Error updating enrollment ${enrollment.id}:`, updateError);
        }
      }
    }

    console.log(`${notificationsToSend.length} certificates ready for notification`);

    // Send webhook notifications
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('webhook_url')
      .single();

    if (settings?.webhook_url && notificationsToSend.length > 0) {
      for (const enrollment of notificationsToSend) {
        try {
          const webhookData = {
            event: 'CERTIFICATE_AVAILABLE',
            enrollment_id: enrollment.id,
            user_id: enrollment.user_id,
            course_id: enrollment.course_id,
            course_name: enrollment.course?.name,
            student_name: enrollment.preEnrollment?.full_name,
            student_email: enrollment.preEnrollment?.email,
            enrollment_date: enrollment.enrollment_date,
            timestamp: new Date().toISOString()
          };

          const response = await fetch(settings.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData)
          });

          if (!response.ok) {
            console.error(`Failed to send webhook for enrollment ${enrollment.id}:`, response.statusText);
          } else {
            console.log(`Webhook sent successfully for enrollment ${enrollment.id}`);
          }
        } catch (webhookError) {
          console.error(`Error sending webhook for enrollment ${enrollment.id}:`, webhookError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Certificate availability check completed',
        checked: enrollments?.length || 0,
        notified: notificationsToSend.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking certificate availability:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});