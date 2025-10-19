import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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
    const { enrollment_id, pre_enrollment_id } = await req.json();

    if (!enrollment_id || !pre_enrollment_id) {
      return new Response(JSON.stringify({ 
        error: "enrollment_id and pre_enrollment_id are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Processing matricula checkout for enrollment: ${enrollment_id}`);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get payment settings
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from('payment_settings')
      .select('environment, asaas_api_key_sandbox, asaas_api_key_production')
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      console.error("Payment settings error:", settingsError);
      return new Response(JSON.stringify({ 
        error: "Sistema de pagamento não configurado" 
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
      return new Response(JSON.stringify({ 
        error: `API key not configured for ${environment}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get enrollment and pre-enrollment data
    const { data: enrollment, error: enrollmentError } = await serviceClient
      .from('enrollments')
      .select(`
        *,
        courses (
          name,
          enrollment_fee
        )
      `)
      .eq('id', enrollment_id)
      .single();

    const { data: preEnrollment, error: preEnrollError } = await serviceClient
      .from('pre_enrollments')
      .select('*')
      .eq('id', pre_enrollment_id)
      .single();

    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (enrollmentError || !enrollment || preEnrollError || !preEnrollment) {
      console.error("Enrollment error:", enrollmentError, "Pre-enrollment error:", preEnrollError);
      return new Response(JSON.stringify({ error: "Enrollment or pre-enrollment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate ownership
    if (enrollment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const enrollmentFee = enrollment.courses.enrollment_fee;
    
    if (!enrollmentFee || enrollmentFee <= 0) {
      return new Response(JSON.stringify({ 
        error: "Taxa de matrícula não configurada" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Helper functions
    const cleanPhone = (phone: string | null): string => {
      if (!phone) return "11999999999";
      const cleaned = phone.replace(/\D/g, '');
      return (cleaned.length >= 10 && cleaned.length <= 11) ? cleaned : "11999999999";
    };

    const cleanPostalCode = (postalCode: string | null): string => {
      if (!postalCode) return "01310200";
      const cleaned = postalCode.replace(/\D/g, '');
      return cleaned.length === 8 ? cleaned : "01310200";
    };

    const cleanCPF = (cpf: string | null): string => {
      if (!cpf) return "00000000000";
      const cleaned = cpf.replace(/\D/g, '');
      return cleaned.length === 11 ? cleaned : "00000000000";
    };

    const getValueWithFallback = (val1: any, val2: any, def: any) => val1 || val2 || def;

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
        description: `Matrícula - ${enrollment.courses.name}`,
        name: enrollment.courses.name,
        quantity: 1,
        value: enrollmentFee
      }],
      customerData: {
        name: getValueWithFallback(preEnrollment.full_name, userProfile?.full_name, "Nome não informado"),
        cpfCnpj: cleanCPF(getValueWithFallback(preEnrollment.cpf, userProfile?.cpf, null)),
        email: getValueWithFallback(preEnrollment.email, userProfile?.email, "email@exemplo.com"),
        phone: cleanPhone(getValueWithFallback(preEnrollment.whatsapp, userProfile?.whatsapp, null)),
        address: getValueWithFallback(preEnrollment.address, userProfile?.address, "Rua não informada"),
        addressNumber: getValueWithFallback(preEnrollment.address_number, userProfile?.address_number, "S/N"),
        postalCode: cleanPostalCode(getValueWithFallback(preEnrollment.postal_code, userProfile?.postal_code, null)),
        province: getValueWithFallback(preEnrollment.state, userProfile?.state, "SP"),
        city: getValueWithFallback(preEnrollment.city, userProfile?.city, "São Paulo")
      }
    };

    const asaasApiUrl = environment === 'production' 
      ? "https://api.asaas.com/v3/checkouts" 
      : "https://sandbox.asaas.com/api/v3/checkouts";
    
    console.log(`Calling Asaas API: ${asaasApiUrl}`);
    console.log("Checkout data:", JSON.stringify(checkoutData, null, 2));
    
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
      return new Response(JSON.stringify({ error: "Failed to create checkout", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const checkoutResult = await asaasResponse.json();
    console.log('Asaas checkout created:', checkoutResult.id);

    // Store payment
    const { data: paymentData, error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        pre_enrollment_id: pre_enrollment_id,
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
      console.log("Payment stored with ID:", paymentData?.id);
      
      // Update enrollment with payment reference
      const { error: updateError } = await serviceClient
        .from('enrollments')
        .update({ 
          enrollment_payment_id: checkoutResult.id 
        })
        .eq('id', enrollment_id);
        
      if (updateError) {
        console.error("Error updating enrollment with payment ID:", updateError);
      }
    }

    const checkoutUrl = checkoutResult.url || 
      `https://${environment === 'production' ? 'asaas.com' : 'sandbox.asaas.com'}/checkoutSession/show?id=${checkoutResult.id}`;

    console.log("Checkout URL generated:", checkoutUrl);

    return new Response(JSON.stringify({
      checkout_url: checkoutUrl,
      checkout_id: checkoutResult.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
