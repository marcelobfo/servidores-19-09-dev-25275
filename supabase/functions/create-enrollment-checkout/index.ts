import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize both clients - anon for auth check, service for data queries
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
    // Parse the request body
    const { pre_enrollment_id } = await req.json();

    if (!pre_enrollment_id) {
      console.error("Missing pre_enrollment_id in request");
      return new Response(JSON.stringify({ error: "pre_enrollment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Processing checkout for pre-enrollment: ${pre_enrollment_id}`);

    // Check if user is authenticated
    const authHeader = req.headers.get('Authorization');
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract token from Bearer string
    const token = authHeader.replace('Bearer ', '');
    console.log("Token extracted:", token.substring(0, 20) + "...");

    // Verify the user with anon client
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError) {
      console.error("Authentication error:", authError.message);
      return new Response(JSON.stringify({ 
        error: "Invalid authentication", 
        details: authError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!user) {
      console.error("No user found in token");
      return new Response(JSON.stringify({ error: "Invalid authentication - no user found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Authenticated user: ${user.id}`);

    // Get payment settings using serviceClient to bypass RLS
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from('payment_settings')
      .select('environment, asaas_api_key_sandbox, asaas_api_key_production')
      .single();

    if (settingsError || !paymentSettings) {
      console.error("Payment settings error:", settingsError);
      return new Response(JSON.stringify({ error: "Payment configuration not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get the appropriate API key based on environment
    const environment = paymentSettings.environment || 'sandbox';
    const asaasApiKey = environment === 'production' 
      ? paymentSettings.asaas_api_key_production 
      : paymentSettings.asaas_api_key_sandbox;

    if (!asaasApiKey) {
      console.error(`Asaas API key not configured for environment: ${environment}`);
      return new Response(JSON.stringify({ error: `API key not configured for ${environment} environment` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get pre-enrollment data using service client to bypass RLS
    const { data: preEnrollment, error: enrollmentError } = await serviceClient
      .from('pre_enrollments')
      .select(`
        *,
        courses (
          name,
          enrollment_fee
        )
      `)
      .eq('id', pre_enrollment_id)
      .single();

    // Get user profile data as fallback
    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (enrollmentError || !preEnrollment) {
      console.error("Pre-enrollment query failed:", enrollmentError);
      console.error("Pre-enrollment ID:", pre_enrollment_id);
      return new Response(JSON.stringify({ error: "Pre-enrollment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate user ownership of the pre-enrollment
    if (preEnrollment.user_id !== user.id) {
      console.error(`User ${user.id} attempted to access pre-enrollment ${pre_enrollment_id} owned by ${preEnrollment.user_id}`);
      return new Response(JSON.stringify({ error: "Unauthorized access to pre-enrollment" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Pre-enrollment found for course: ${preEnrollment.courses.name}`);

    const enrollmentFee = preEnrollment.courses.enrollment_fee;
    
    if (!enrollmentFee || enrollmentFee <= 0) {
      console.error("Course enrollment fee not configured:", preEnrollment.courses.name);
      return new Response(JSON.stringify({ 
        error: "Taxa de matrícula não configurada para este curso. Entre em contato com o suporte." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Helper function to clean and validate phone number
    const cleanPhone = (phone: string | null): string => {
      if (!phone) return "11999999999"; // Valid São Paulo number as fallback
      const cleaned = phone.replace(/\D/g, '');
      
      // Must have at least 10 digits (landline) or 11 digits (mobile)
      if (cleaned.length >= 10 && cleaned.length <= 11) {
        return cleaned;
      }
      
      return "11999999999"; // Valid São Paulo number as fallback
    };

    // Helper function to clean and validate postal code
    const cleanPostalCode = (postalCode: string | null): string => {
      if (!postalCode) return "01310200"; // Valid São Paulo CEP as fallback
      const cleaned = postalCode.replace(/\D/g, '');
      
      // Must have exactly 8 digits
      if (cleaned.length === 8) {
        return cleaned;
      }
      
      return "01310200"; // Valid São Paulo CEP as fallback
    };

    // Helper function to clean CPF
    const cleanCPF = (cpf: string | null): string => {
      if (!cpf) return "00000000000";
      const cleaned = cpf.replace(/\D/g, '');
      
      // Must have exactly 11 digits
      if (cleaned.length === 11) {
        return cleaned;
      }
      
      return "00000000000";
    };

    // Helper function to get value with fallback from profile
    const getValueWithFallback = (preEnrollmentValue: any, profileValue: any, defaultValue: any) => {
      return preEnrollmentValue || profileValue || defaultValue;
    };

    console.log('Preparing customer data with validation...');
    console.log('Pre-enrollment data:', {
      whatsapp: preEnrollment.whatsapp,
      postal_code: preEnrollment.postal_code,
      cpf: preEnrollment.cpf,
      address: preEnrollment.address,
      state: preEnrollment.state,
      city: preEnrollment.city
    });
    
    console.log('Profile data:', userProfile ? {
      whatsapp: userProfile.whatsapp,
      postal_code: userProfile.postal_code,
      cpf: userProfile.cpf,
      address: userProfile.address,
      state: userProfile.state,
      city: userProfile.city
    } : 'No profile data');

    // Create Asaas checkout following official documentation
    const checkoutData = {
      billingTypes: ["CREDIT_CARD", "PIX"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${req.headers.get("origin")}/student?payment_success=true`,
        cancelUrl: `${req.headers.get("origin")}/student?payment_cancelled=true`,
        expiredUrl: `${req.headers.get("origin")}/student?payment_expired=true`
      },
      items: [{
        externalReference: pre_enrollment_id,
        description: `Matrícula - ${preEnrollment.courses.name}`,
        name: preEnrollment.courses.name,
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

    console.log('Final customer data:', checkoutData.customerData);

    // Use the configured environment from settings
    const asaasApiUrl = environment === 'production' 
      ? "https://api.asaas.com/v3/checkouts" 
      : "https://sandbox.asaas.com/api/v3/checkouts";
    
    console.log(`Using Asaas API URL: ${asaasApiUrl} (environment: ${environment})`);
    
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
      return new Response(JSON.stringify({ error: "Failed to create checkout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const checkoutResult = await asaasResponse.json();
    console.log('Asaas checkout response:', checkoutResult);

    // Store checkout info in payments table
    const { error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        pre_enrollment_id: pre_enrollment_id,
        amount: enrollmentFee,
        currency: 'BRL',
        status: 'pending',
        kind: 'enrollment',
        asaas_payment_id: checkoutResult.id
      });

    if (paymentError) {
      console.error("Error storing payment:", paymentError);
    }

    // Construct checkout URL if not provided directly
    const checkoutUrl = checkoutResult.url || 
      `https://${environment === 'production' ? 'asaas.com' : 'sandbox.asaas.com'}/checkoutSession/show?id=${checkoutResult.id}`;

    if (!checkoutResult.id) {
      console.error("Asaas did not return checkout ID:", checkoutResult);
      return new Response(JSON.stringify({ error: "Failed to create checkout - no ID returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      checkout_url: checkoutUrl,
      checkout_id: checkoutResult.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});