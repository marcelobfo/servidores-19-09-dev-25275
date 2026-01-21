import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Default API URLs
const DEFAULT_SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const DEFAULT_PRODUCTION_URL = "https://api.asaas.com/v3";

// Helper functions
const cleanCPF = (cpf: string | null): string => {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
};

const cleanPhone = (phone: string | null): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 11 ? cleaned : "";
};

const cleanPostalCode = (postalCode: string | null): string => {
  if (!postalCode) return "";
  const cleaned = postalCode.replace(/\D/g, "");
  return cleaned.length === 8 ? cleaned : "";
};

const truncate = (str: string | null | undefined, max: number): string => {
  if (!str) return "";
  const trimmed = str.trim();
  return trimmed.length <= max ? trimmed : trimmed.substring(0, max);
};

// Get or create Asaas customer
async function getOrCreateAsaasCustomer(
  asaasApiKey: string, 
  asaasApiUrl: string,
  customerData: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    address: string;
    addressNumber: string;
    province: string;
  }
): Promise<{ id: string; error?: string }> {
  console.log("🔍 Buscando/criando customer no Asaas...");
  console.log(`📡 API URL: ${asaasApiUrl}`);
  
  if (customerData.cpfCnpj) {
    try {
      const searchUrl = `${asaasApiUrl}/customers?cpfCnpj=${customerData.cpfCnpj}`;
      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
      });
      
      const searchResult = await searchResponse.json();
      
      if (searchResult.data && searchResult.data.length > 0) {
        console.log("✅ Customer encontrado:", searchResult.data[0].id);
        return { id: searchResult.data[0].id };
      }
    } catch (searchError) {
      console.log("⚠️ Erro ao buscar customer:", searchError);
    }
  }
  
  console.log("📝 Criando novo customer...");
  
  const createPayload = {
    name: customerData.name || "Nome não informado",
    cpfCnpj: customerData.cpfCnpj,
    email: customerData.email,
    phone: customerData.phone,
    postalCode: customerData.postalCode,
    address: customerData.address,
    addressNumber: customerData.addressNumber || "S/N",
    province: customerData.province,
  };
  
  try {
    const createResponse = await fetch(`${asaasApiUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(createPayload),
    });
    
    const createResult = await createResponse.json();
    
    if (!createResponse.ok) {
      return { id: "", error: JSON.stringify(createResult) };
    }
    
    console.log("✅ Customer criado:", createResult.id);
    return { id: createResult.id };
  } catch (createError) {
    return { id: "", error: String(createError) };
  }
}

console.log("🔧 create-discounted-checkout v34 - Using /v3/payments API with configurable URLs");

serve(async (req) => {
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, function: "create-discounted-checkout", version: "v34", api: "/v3/payments" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    console.log("🚀 Create Discounted Checkout v34 - Started");

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const token = authHeader.replace(/^bearer\s+/i, "");
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log(`✅ Authenticated user: ${userId}`);

    // Get payment settings including custom URLs
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from("payment_settings")
      .select("environment, asaas_api_key_sandbox, asaas_api_key_production, asaas_base_url_sandbox, asaas_base_url_production")
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      return new Response(JSON.stringify({ error: "Sistema de pagamento não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawEnvironment = (paymentSettings.environment ?? "sandbox").toString().toLowerCase().trim();
    const environment =
      rawEnvironment === "production" || rawEnvironment === "prod" || rawEnvironment === "producao" || rawEnvironment === "produção"
        ? "production"
        : "sandbox";

    const asaasApiKey = environment === "production" 
      ? paymentSettings.asaas_api_key_production 
      : paymentSettings.asaas_api_key_sandbox;

    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: `API key not configured for ${environment}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use custom URL from settings, or fall back to defaults
    const asaasApiUrl = environment === "production"
      ? ((paymentSettings as any).asaas_base_url_production || DEFAULT_PRODUCTION_URL)
      : ((paymentSettings as any).asaas_base_url_sandbox || DEFAULT_SANDBOX_URL);

    console.log(`🌐 Environment: ${environment}`);
    console.log(`🔗 API URL: ${asaasApiUrl}`);

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
      return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (enrollment.user_id !== userId) {
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

    // Calculate discount
    const { data: confirmedPrePayment } = await serviceClient
      .from("payments")
      .select("amount")
      .eq("pre_enrollment_id", preEnrollment.id)
      .eq("kind", "pre_enrollment")
      .in("status", ["confirmed", "received"])
      .maybeSingle();

    const originalFee = course.enrollment_fee || 0;
    const preEnrollmentDiscount = confirmedPrePayment?.amount ? Number(confirmedPrePayment.amount) : 0;
    
    let finalAmount: number;
    if (force_amount && force_amount > 0) {
      finalAmount = Math.max(force_amount, 5);
    } else {
      finalAmount = Math.max(originalFee - preEnrollmentDiscount, 5);
    }

    console.log(`💰 Valor: Original R$ ${originalFee} - Desconto R$ ${preEnrollmentDiscount} = Final R$ ${finalAmount}`);

    // Cancel existing pending payments
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

    // Prepare customer data
    const customerData = {
      name: truncate(preEnrollment.full_name, 120) || "Nome não informado",
      cpfCnpj: cleanCPF(preEnrollment.cpf),
      email: preEnrollment.email || "email@exemplo.com",
      phone: cleanPhone(preEnrollment.whatsapp),
      postalCode: cleanPostalCode(preEnrollment.postal_code),
      address: truncate(preEnrollment.address, 120) || "Rua não informada",
      addressNumber: preEnrollment.address_number || "S/N",
      province: truncate(preEnrollment.state, 30) || "SP",
    };

    // Validate CPF
    if (!customerData.cpfCnpj || customerData.cpfCnpj.length !== 11) {
      return new Response(JSON.stringify({ 
        error: "CPF inválido ou não informado" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create Asaas customer
    const { id: customerId, error: customerError } = await getOrCreateAsaasCustomer(
      asaasApiKey,
      asaasApiUrl,
      customerData
    );

    if (!customerId) {
      return new Response(JSON.stringify({ 
        error: "Erro ao criar cliente no Asaas",
        details: customerError
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateString = dueDate.toISOString().split('T')[0];

    // Billing type: UNDEFINED in production (all methods), PIX in sandbox
    const billingType = environment === "production" ? "UNDEFINED" : "PIX";

    // Create payment using /v3/payments API
    // IMPORTANT: Using "billingType" (singular) NOT "billingTypes" (plural)
    const paymentData = {
      customer: customerId,
      billingType: billingType,
      value: finalAmount,
      dueDate: dueDateString,
      description: `Matrícula com desconto - ${truncate(course.name, 50)}`,
      externalReference: enrollment_id,
      postalService: false,
    };

    console.log("📤 Payment payload:", JSON.stringify(paymentData));
    console.log(`📡 POST ${asaasApiUrl}/payments`);

    let paymentResponse = await fetch(`${asaasApiUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentData),
    });

    let responseText = await paymentResponse.text();
    console.log("📊 Asaas Response:", paymentResponse.status, responseText);

    // Fallback to PIX if UNDEFINED fails
    if (!paymentResponse.ok && billingType === "UNDEFINED") {
      console.log("⚠️ Fallback para PIX...");
      paymentData.billingType = "PIX";
      
      paymentResponse = await fetch(`${asaasApiUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify(paymentData),
      });
      
      responseText = await paymentResponse.text();
      console.log("📊 Fallback Response:", paymentResponse.status, responseText);
    }

    if (!paymentResponse.ok) {
      return new Response(JSON.stringify({ 
        error: "Falha ao criar pagamento", 
        details: responseText 
      }), {
        status: paymentResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentResult = JSON.parse(responseText);
    console.log("✅ Payment criado:", paymentResult.id);

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
        asaas_payment_id: paymentResult.id,
      });

    if (paymentError) {
      console.error("Error storing payment:", paymentError);
    }

    // Update enrollment
    await serviceClient
      .from("enrollments")
      .update({ 
        enrollment_payment_id: paymentResult.id,
        enrollment_amount: finalAmount
      })
      .eq("id", enrollment_id);

    const invoiceUrl = paymentResult.invoiceUrl || 
      `https://${environment === "production" ? "www.asaas.com" : "sandbox.asaas.com"}/i/${paymentResult.id}`;

    return new Response(
      JSON.stringify({
        checkout_url: invoiceUrl,
        invoice_url: invoiceUrl,
        payment_id: paymentResult.id,
        checkout_id: paymentResult.id,
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
