import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

console.log("🔧 create-discounted-checkout function loaded");

serve(async (req) => {
  const method = req.method;
  console.log(`📨 Request received: ${method} ${req.url}`);

  // Handle CORS preflight requests - must be first, outside try/catch
  if (method === "OPTIONS") {
    console.log("✅ OPTIONS preflight - returning 200");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Health check endpoint
  if (method === "GET") {
    console.log("✅ GET health check");
    return new Response(
      JSON.stringify({ 
        ok: true, 
        function: "create-discounted-checkout",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Only POST allowed beyond this point
  if (method !== "POST") {
    console.log(`❌ Method not allowed: ${method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    console.log("🚀 Create Discounted Checkout - Started");

    // Safe JSON parsing
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("❌ Invalid JSON body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    const { enrollment_id, force_amount } = body;

    if (!enrollment_id) {
      return new Response(JSON.stringify({ error: "enrollment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Authenticated user: ${user.id}`);

    // Get payment settings
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from("payment_settings")
      .select("environment, asaas_api_key_sandbox, asaas_api_key_production")
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      return new Response(JSON.stringify({ error: "Sistema de pagamento não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const environment = paymentSettings.environment || "sandbox";
    const asaasApiKey = environment === "production" 
      ? paymentSettings.asaas_api_key_production 
      : paymentSettings.asaas_api_key_sandbox;

    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: `API key not configured for ${environment}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get enrollment with course and pre-enrollment data
    const { data: enrollment, error: enrollmentError } = await serviceClient
      .from("enrollments")
      .select(`
        *,
        courses (id, name, enrollment_fee),
        pre_enrollments (id, full_name, email, cpf, whatsapp, address, address_number, postal_code, state, city)
      `)
      .eq("id", enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      console.error("Enrollment not found:", enrollmentError);
      return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (enrollment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preEnrollment = enrollment.pre_enrollments;
    const course = enrollment.courses;

    if (!course || !preEnrollment) {
      return new Response(JSON.stringify({ error: "Dados da matrícula incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate discount from confirmed pre-enrollment payment
    const { data: confirmedPrePayment } = await serviceClient
      .from("payments")
      .select("amount")
      .eq("pre_enrollment_id", preEnrollment.id)
      .eq("kind", "pre_enrollment")
      .in("status", ["confirmed", "received"])
      .maybeSingle();

    const originalFee = course.enrollment_fee || 0;
    const preEnrollmentDiscount = confirmedPrePayment?.amount ? Number(confirmedPrePayment.amount) : 0;
    
    // Use force_amount if provided, otherwise calculate
    let finalAmount: number;
    if (force_amount && force_amount > 0) {
      finalAmount = Math.max(force_amount, 5); // Minimum R$ 5.00
    } else {
      finalAmount = Math.max(originalFee - preEnrollmentDiscount, 5);
    }

    console.log("💰 Cálculo do valor:");
    console.log(`   Original fee: R$ ${originalFee}`);
    console.log(`   Pre-enrollment discount: R$ ${preEnrollmentDiscount}`);
    console.log(`   Force amount: ${force_amount || 'N/A'}`);
    console.log(`   Final amount: R$ ${finalAmount}`);

    // Cancel any existing pending payments for this enrollment
    const { data: existingPayments } = await serviceClient
      .from("payments")
      .select("id")
      .eq("enrollment_id", enrollment_id)
      .eq("kind", "enrollment")
      .in("status", ["pending", "waiting"]);

    if (existingPayments && existingPayments.length > 0) {
      console.log(`📛 Cancelando ${existingPayments.length} checkout(s) antigo(s)...`);
      await serviceClient
        .from("payments")
        .update({ status: "cancelled" })
        .eq("enrollment_id", enrollment_id)
        .eq("kind", "enrollment")
        .in("status", ["pending", "waiting"]);
    }

    // Helper functions
    const cleanPhone = (phone: string | null): string => {
      if (!phone) return "11999999999";
      const cleaned = phone.replace(/\D/g, "");
      return (cleaned.length >= 10 && cleaned.length <= 11) ? cleaned : "11999999999";
    };

    const cleanPostalCode = (postalCode: string | null): string => {
      if (!postalCode) return "01310200";
      const cleaned = postalCode.replace(/\D/g, "");
      return cleaned.length === 8 ? cleaned : "01310200";
    };

    const cleanCPF = (cpf: string | null): string => {
      if (!cpf) return "00000000000";
      const cleaned = cpf.replace(/\D/g, "");
      return cleaned.length === 11 ? cleaned : "00000000000";
    };

    const truncate = (str: string, max: number): string => {
      const trimmed = str.trim();
      return trimmed.length <= max ? trimmed : trimmed.substring(0, max);
    };

    // Build checkout data
    const origin = req.headers.get("origin") || "https://6be1b209-32ae-497f-88c1-5af12f9e3bfe.lovableproject.com";

    // FIXADO: Usar APENAS PIX para evitar erro "billingTypes é inválido"
    // O Asaas requer verificação de Dados Comerciais para habilitar CREDIT_CARD e BOLETO
    // Mesmo em produção, PIX é a opção mais segura até a conta estar 100% verificada
    const allowedBillingTypes = ["PIX"];

    console.log(`🔄 Ambiente: ${environment} - billingTypes: ${JSON.stringify(allowedBillingTypes)} (FIXADO EM PIX)`);

    const checkoutData = {
      billingTypes: allowedBillingTypes,
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${origin}/student/enrollments?payment_success=true`,
        cancelUrl: `${origin}/student/enrollments?payment_cancelled=true`,
        expiredUrl: `${origin}/student/enrollments?payment_expired=true`,
      },
      items: [{
        externalReference: enrollment_id,
        description: "Matricula",
        name: "Licenca Capacitacao",
        quantity: 1,
        value: finalAmount,
      }],
      customerData: {
        name: truncate(preEnrollment.full_name || "Nome não informado", 30),
        cpfCnpj: cleanCPF(preEnrollment.cpf),
        email: preEnrollment.email || "email@exemplo.com",
        phone: cleanPhone(preEnrollment.whatsapp),
        address: truncate(preEnrollment.address || "Rua não informada", 60),
        addressNumber: preEnrollment.address_number || "S/N",
        postalCode: cleanPostalCode(preEnrollment.postal_code),
        province: truncate(preEnrollment.state || "SP", 30),
        city: truncate(preEnrollment.city || "São Paulo", 40),
      },
    };

    console.log("📤 Dados do checkout:", JSON.stringify(checkoutData, null, 2));

    // Call Asaas API
    const asaasApiUrl = environment === "production"
      ? "https://api.asaas.com/v3/checkouts"
      : "https://sandbox.asaas.com/api/v3/checkouts";

    console.log(`🔄 Chamando Asaas API (${environment})...`);

    const asaasResponse = await fetch(asaasApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(checkoutData),
    });

    const responseText = await asaasResponse.text();
    console.log("📊 Asaas Response:", asaasResponse.status, responseText);

    if (!asaasResponse.ok) {
      console.error("❌ Asaas API error:", responseText);
      return new Response(JSON.stringify({ 
        error: "Falha ao criar checkout", 
        details: responseText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutResult = JSON.parse(responseText);
    console.log("✅ Checkout criado:", checkoutResult.id);

    // Store payment record
    const { error: paymentError } = await serviceClient
      .from("payments")
      .insert({
        pre_enrollment_id: preEnrollment.id,
        enrollment_id: enrollment_id,
        amount: finalAmount,
        currency: "BRL",
        status: "pending",
        kind: "enrollment",
        asaas_payment_id: checkoutResult.id,
      });

    if (paymentError) {
      console.error("Error storing payment:", paymentError);
    }

    // Update enrollment
    await serviceClient
      .from("enrollments")
      .update({ 
        enrollment_payment_id: checkoutResult.id,
        enrollment_amount: finalAmount
      })
      .eq("id", enrollment_id);

    const checkoutUrl = checkoutResult.url ||
      `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${checkoutResult.id}`;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        checkout_id: checkoutResult.id,
        original_fee: originalFee,
        discount: preEnrollmentDiscount,
        final_amount: finalAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error?.message || "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
