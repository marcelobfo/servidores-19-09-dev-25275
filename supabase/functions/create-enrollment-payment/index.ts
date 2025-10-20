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

    // Get enrollment with pre_enrollment and course data
    const { data: enrollment, error: enrollmentError } = await serviceClient
      .from('enrollments')
      .select(`
        *,
        pre_enrollment:pre_enrollments (
          *,
          course:courses (
            name,
            enrollment_fee
          )
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
    const enrollmentFee = enrollment.pre_enrollment?.course?.enrollment_fee;
    if (!enrollmentFee || enrollmentFee <= 0) {
      console.error("Enrollment fee not configured:", {
        enrollmentId: enrollment_id,
        courseName: enrollment.pre_enrollment?.course?.name,
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
      .select('id, asaas_payment_id')
      .eq('enrollment_id', enrollment_id)
      .eq('kind', 'enrollment')
      .in('status', ['pending', 'waiting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.asaas_payment_id) {
      console.log('Reusing existing payment:', existingPayment.id);
      const checkoutUrl = `https://${environment === 'production' ? 'asaas.com' : 'sandbox.asaas.com'}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
      
      return new Response(JSON.stringify({
        checkout_url: checkoutUrl,
        checkout_id: existingPayment.asaas_payment_id,
        reused: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

    const truncateName = (name: string, maxLength: number = 30): string => {
      return name.length <= maxLength ? name : name.substring(0, maxLength - 3) + '...';
    };

    // Get user profile for fallback data
    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const preEnrollment = enrollment.pre_enrollment;
    const courseName = preEnrollment?.course?.name || 'Curso';

    // Create Asaas checkout
    const checkoutData = {
      billingTypes: ["CREDIT_CARD", "PIX", "BOLETO"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${req.headers.get("origin")}/student/enrollments?payment_success=true`,
        cancelUrl: `${req.headers.get("origin")}/student/enrollments?payment_cancelled=true`,
        expiredUrl: `${req.headers.get("origin")}/student/enrollments?payment_expired=true`
      },
      items: [{
        externalReference: enrollment_id,
        description: `Matrícula - ${courseName}`,
        name: truncateName(courseName),
        quantity: 1,
        value: enrollmentFee
      }],
      customerData: {
        name: preEnrollment?.full_name || userProfile?.full_name || "Nome não informado",
        cpfCnpj: cleanCPF(preEnrollment?.cpf || userProfile?.cpf),
        email: preEnrollment?.email || userProfile?.email || "email@exemplo.com",
        phone: cleanPhone(preEnrollment?.whatsapp || userProfile?.whatsapp),
        address: preEnrollment?.address || userProfile?.address || "Rua não informada",
        addressNumber: preEnrollment?.address_number || userProfile?.address_number || "S/N",
        postalCode: cleanPostalCode(preEnrollment?.postal_code || userProfile?.postal_code),
        province: preEnrollment?.state || userProfile?.state || "SP",
        city: preEnrollment?.city || userProfile?.city || "São Paulo"
      }
    };

    console.log('Creating Asaas checkout:', { environment, enrollmentFee, courseName });

    const asaasApiUrl = environment === 'production' 
      ? "https://api.asaas.com/v3/checkouts" 
      : "https://sandbox.asaas.com/api/v3/checkouts";

    const asaasResponse = await fetch(asaasApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey
      },
      body: JSON.stringify(checkoutData)
    });

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text();
      console.error("Asaas API error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao criar checkout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const checkoutResult = await asaasResponse.json();
    console.log('Asaas checkout created:', checkoutResult.id);

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
          asaas_payment_id: checkoutResult.id
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
          .update({ enrollment_payment_id: checkoutResult.id })
          .eq('id', enrollment_id);
      }
    } catch (error) {
      console.error("Exception storing payment:", error);
    }

    const checkoutUrl = checkoutResult.url || 
      `https://${environment === 'production' ? 'asaas.com' : 'sandbox.asaas.com'}/checkoutSession/show?id=${checkoutResult.id}`;

    return new Response(JSON.stringify({
      checkout_url: checkoutUrl,
      checkout_id: checkoutResult.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
