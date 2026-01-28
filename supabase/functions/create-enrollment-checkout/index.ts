import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const truncateName = (name: string | null | undefined, maxLength = 30): string => {
  if (!name) return "";
  const trimmed = name.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.substring(0, maxLength);
};

const getValueWithFallback = (...values: (string | null | undefined)[]): string => {
  for (const value of values) {
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
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
  
  // First, search for existing customer by CPF
  if (customerData.cpfCnpj) {
    try {
      const searchUrl = `${asaasApiUrl}/customers?cpfCnpj=${customerData.cpfCnpj}`;
      console.log("🔍 Buscando customer por CPF:", searchUrl);
      
      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
      });
      
      const searchResult = await searchResponse.json();
      console.log("🔍 Resultado busca customer:", JSON.stringify(searchResult));
      
      if (searchResult.data && searchResult.data.length > 0) {
        console.log("✅ Customer encontrado:", searchResult.data[0].id);
        return { id: searchResult.data[0].id };
      }
    } catch (searchError) {
      console.log("⚠️ Erro ao buscar customer (continuando para criar):", searchError);
    }
  }
  
  // Create new customer
  console.log("📝 Criando novo customer no Asaas...");
  
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
  
  console.log("📤 Customer payload:", JSON.stringify(createPayload));
  
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
    console.log("📊 Create customer response:", JSON.stringify(createResult));
    
    if (!createResponse.ok) {
      console.error("❌ Erro ao criar customer:", createResult);
      return { id: "", error: JSON.stringify(createResult) };
    }
    
    console.log("✅ Customer criado:", createResult.id);
    return { id: createResult.id };
  } catch (createError) {
    console.error("❌ Exception ao criar customer:", createError);
    return { id: "", error: String(createError) };
  }
}

console.log("🔧 create-enrollment-checkout v34 - Using /v3/payments API with configurable URLs");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    console.log("🚀 Edge function started - v34 with configurable URLs");

    // Parse request body
    const body = await req.json();
    console.log("📦 Request body:", JSON.stringify(body));

    const { pre_enrollment_id, enrollment_id, force_recalculate, override_amount } = body;

    if (!pre_enrollment_id) {
      return new Response(JSON.stringify({ error: "pre_enrollment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const forceRecalculate = force_recalculate === true;
    const overrideAmountNumber = typeof override_amount === "number" ? override_amount : Number(override_amount);
    const hasOverrideAmount = Number.isFinite(overrideAmountNumber) && overrideAmountNumber > 0;
    const isEnrollmentCheckout = !!enrollment_id;

    console.log(`Processing ${isEnrollmentCheckout ? "enrollment" : "pre-enrollment"} checkout`);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerLower = authHeader.toLowerCase();
    if (!headerLower.startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Malformed Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = authHeader.split(/\s+/);
    const token = parts[1]?.trim();
    
    if (!token || token.split('.').length !== 3) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token - no user ID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Authenticated user: ${userId}`);
    const user = { id: userId, email: claimsData.claims.email as string };

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

    // Get pre-enrollment data
    const { data: preEnrollment, error: preEnrollmentError } = await serviceClient
      .from("pre_enrollments")
      .select(`
        *,
        courses (
          name,
          asaas_title,
          pre_enrollment_fee,
          enrollment_fee,
          discounted_enrollment_fee
        )
      `)
      .eq("id", pre_enrollment_id)
      .single();

    if (preEnrollmentError || !preEnrollment) {
      return new Response(JSON.stringify({ error: "Pré-matrícula não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (preEnrollment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso não autorizado à pré-matrícula" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get enrollment if provided
    let enrollment = null;
    if (isEnrollmentCheckout) {
      const { data: enrollmentData, error: enrollmentError } = await serviceClient
        .from("enrollments")
        .select("*")
        .eq("id", enrollment_id)
        .single();

      if (enrollmentError || !enrollmentData) {
        return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (enrollmentData.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Acesso não autorizado à matrícula" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      enrollment = enrollmentData;
    }

    // Get user profile as fallback
    const { data: userProfile } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    console.log(`Pre-enrollment found for course: ${preEnrollment.courses?.name || "UNKNOWN"}`);

    // Check for existing pending payment
    const checkoutKind = isEnrollmentCheckout ? "enrollment" : "pre_enrollment";
    let paymentQuery = serviceClient
      .from("payments")
      .select("id, status, asaas_payment_id, amount")
      .eq("pre_enrollment_id", pre_enrollment_id)
      .eq("kind", checkoutKind)
      .in("status", ["pending", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (isEnrollmentCheckout && enrollment_id) {
      paymentQuery = paymentQuery.eq("enrollment_id", enrollment_id);
    }

    const { data: existingPayment } = await paymentQuery.maybeSingle();

    // Calculate the checkout fee
    let checkoutFee: number;
    let checkoutReason: string = "standard";
    let prePaidTotal = 0;

    if (hasOverrideAmount) {
      checkoutFee = overrideAmountNumber;
      checkoutReason = "override_amount";
      console.log(`💵 Using override_amount: R$ ${checkoutFee}`);
    } else if (isEnrollmentCheckout) {
      // Get confirmed pre-enrollment payment
      const { data: confirmedPrePayment } = await serviceClient
        .from("payments")
        .select("amount")
        .eq("pre_enrollment_id", pre_enrollment_id)
        .eq("kind", "pre_enrollment")
        .in("status", ["confirmed", "received"])
        .maybeSingle();

      // FIXED: Check for manual_approval as fallback for discount (like frontend does)
      const creditFromPayments = confirmedPrePayment?.amount ? Number(confirmedPrePayment.amount) : 0;
      const preEnrollmentFee = preEnrollment.courses?.pre_enrollment_fee || 0;
      
      // If manual_approval is true but no payment exists, infer credit from pre_enrollment_fee
      const isManuallyApproved = preEnrollment.manual_approval === true;
      const inferredCredit = isManuallyApproved && creditFromPayments === 0 ? preEnrollmentFee : 0;
      
      prePaidTotal = creditFromPayments + inferredCredit;
      
      const originalFee = preEnrollment.courses?.enrollment_fee || 0;
      const discountedFee = preEnrollment.courses?.discounted_enrollment_fee || 0;

      console.log(`📊 Discount calculation: creditFromPayments=${creditFromPayments}, inferredCredit=${inferredCredit}, prePaidTotal=${prePaidTotal}, manual_approval=${isManuallyApproved}`);

      if (prePaidTotal > 0 && discountedFee > 0) {
        checkoutFee = Math.min(discountedFee, originalFee - prePaidTotal);
        checkoutReason = "discounted_enrollment";
      } else if (prePaidTotal > 0) {
        checkoutFee = Math.max(originalFee - prePaidTotal, 5);
        checkoutReason = "pre_payment_credit";
      } else if (discountedFee > 0 && discountedFee < originalFee) {
        // FIXED: Also apply discount if discounted_fee is set in database, even without payment
        checkoutFee = discountedFee;
        checkoutReason = "discounted_fee_preset";
      } else {
        checkoutFee = originalFee;
        checkoutReason = "full_enrollment";
      }

      checkoutFee = Math.max(checkoutFee, 5); // Minimum R$ 5.00
    } else {
      checkoutFee = preEnrollment.courses?.pre_enrollment_fee || 0;
      checkoutReason = "pre_enrollment";
    }

    console.log(`💰 Checkout fee: R$ ${checkoutFee} (reason: ${checkoutReason}, prePaidTotal: R$ ${prePaidTotal})`);

    // Handle existing payment reuse or cancellation
    if (existingPayment && hasOverrideAmount) {
      const existingAmount = Number(existingPayment.amount || 0);
      const tolerance = 0.5;
      
      if (Math.abs(existingAmount - overrideAmountNumber) > tolerance) {
        console.log(`⚠️ Cancelling old checkout with different amount`);
        await serviceClient
          .from("payments")
          .update({ status: 'cancelled' })
          .eq("id", existingPayment.id);
      } else {
        console.log(`✅ Reusing existing checkout with matching amount`);
        const invoiceUrl = existingPayment.asaas_payment_id 
          ? `https://${environment === "production" ? "www.asaas.com" : "sandbox.asaas.com"}/i/${existingPayment.asaas_payment_id}`
          : null;
        
        return new Response(
          JSON.stringify({
            checkout_url: invoiceUrl,
            invoice_url: invoiceUrl,
            checkout_id: existingPayment.asaas_payment_id,
            reused: true,
            applied_amount: existingAmount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    } else if (existingPayment && !forceRecalculate) {
      if (isEnrollmentCheckout && prePaidTotal > 0) {
        const existingPaymentAmount = Number(existingPayment.amount);
        const originalFee = preEnrollment.courses?.enrollment_fee || 0;
        
        if (existingPaymentAmount >= originalFee - 1) {
          console.log("⚠️ Old checkout has full amount but discount should apply - cancelling");
          await serviceClient
            .from("payments")
            .update({ status: 'cancelled' })
            .eq("id", existingPayment.id);
        } else {
          console.log("✅ Reusing existing discounted checkout");
          const invoiceUrl = `https://${environment === "production" ? "www.asaas.com" : "sandbox.asaas.com"}/i/${existingPayment.asaas_payment_id}`;
          return new Response(
            JSON.stringify({
              checkout_url: invoiceUrl,
              invoice_url: invoiceUrl,
              checkout_id: existingPayment.asaas_payment_id,
              reused: true,
              applied_amount: existingPaymentAmount,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }
      } else {
        console.log("✅ Reusing existing payment");
        const invoiceUrl = `https://${environment === "production" ? "www.asaas.com" : "sandbox.asaas.com"}/i/${existingPayment.asaas_payment_id}`;
        return new Response(
          JSON.stringify({
            checkout_url: invoiceUrl,
            invoice_url: invoiceUrl,
            checkout_id: existingPayment.asaas_payment_id,
            reused: true,
            applied_amount: Number(existingPayment.amount),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    } else if (existingPayment && forceRecalculate) {
      console.log("🔄 force_recalculate=true - Cancelling old checkout");
      await serviceClient
        .from("payments")
        .update({ status: 'cancelled' })
        .eq("id", existingPayment.id);
    }

    // Prepare customer data
    const customerData = {
      name: truncateName(getValueWithFallback(preEnrollment.full_name, userProfile?.full_name, "Nome não informado"), 120),
      cpfCnpj: cleanCPF(getValueWithFallback(preEnrollment.cpf, userProfile?.cpf, null)),
      email: getValueWithFallback(preEnrollment.email, userProfile?.email, "email@exemplo.com").substring(0, 80),
      phone: cleanPhone(getValueWithFallback(preEnrollment.whatsapp, userProfile?.whatsapp, null)),
      postalCode: cleanPostalCode(getValueWithFallback(preEnrollment.postal_code, userProfile?.postal_code, null)),
      address: truncateName(getValueWithFallback(preEnrollment.address, userProfile?.address, "Rua não informada"), 120),
      addressNumber: getValueWithFallback(preEnrollment.address_number, userProfile?.address_number, "S/N"),
      province: truncateName(getValueWithFallback(preEnrollment.state, userProfile?.state, "SP"), 30),
    };

    console.log("👤 Customer data:", JSON.stringify(customerData));

    // Validate required customer fields
    if (!customerData.cpfCnpj || customerData.cpfCnpj.length !== 11) {
      return new Response(JSON.stringify({ 
        error: "CPF inválido ou não informado",
        details: "O CPF deve ter 11 dígitos numéricos"
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

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateString = dueDate.toISOString().split('T')[0];

    // Build payment description
    const courseName = preEnrollment.courses?.name || "Curso";
    const paymentDescription = isEnrollmentCheckout 
      ? `Matrícula - ${truncateName(courseName, 60)}`
      : `Pré-Matrícula - ${truncateName(courseName, 60)}`;

    // Determine billing type
    // Pre-enrollment: PIX only
    // Enrollment: UNDEFINED (allows PIX, Boleto, Card) in production, PIX in sandbox
    // Localize esta lógica no seu código e ajuste para ficar assim:
let billingType: string;

if (!isEnrollmentCheckout) {
  billingType = "PIX"; // Pré-matrícula continua apenas PIX
} else {
  // Para Matrícula (Enrollment), liberamos todas as formas (UNDEFINED)
  // tanto em Produção quanto em Sandbox para permitir seus testes.
  billingType = "UNDEFINED"; 
}

    console.log(`💳 Billing type definido como: ${billingType} (environment: ${environment}, isEnrollment: ${isEnrollmentCheckout})`);

    // Create payment using /v3/payments API
    // IMPORTANT: Using "billingType" (singular) NOT "billingTypes" (plural)
    const paymentData = {
      customer: customerId,
      billingType: billingType,
      value: checkoutFee,
      dueDate: dueDateString,
      description: paymentDescription,
      externalReference: isEnrollmentCheckout ? enrollment_id : pre_enrollment_id,
      postalService: false,
    };

    console.log("📤 Payment payload:", JSON.stringify(paymentData));
    console.log(`📡 POST ${asaasApiUrl}/payments`);

    const paymentResponse = await fetch(`${asaasApiUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentData),
    });

    // Get response as text first for validation
    const paymentResponseText = await paymentResponse.text();
    console.log("📊 Payment Response:", paymentResponse.status, paymentResponseText);

    if (!paymentResponse.ok) {
      console.error("❌ Erro retornado pelo Asaas:", paymentResponseText);
      
      // If UNDEFINED billing type fails, try PIX only as fallback
      if (billingType === "UNDEFINED") {
        console.log("⚠️ UNDEFINED billing type failed, trying PIX...");
        
        paymentData.billingType = "PIX";
        
        const retryResponse = await fetch(`${asaasApiUrl}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey,
          },
          body: JSON.stringify(paymentData),
        });

        const retryResponseText = await retryResponse.text();
        console.log("📊 Retry Response:", retryResponse.status, retryResponseText);

        if (!retryResponse.ok) {
          return new Response(JSON.stringify({ 
            error: "Falha ao criar pagamento",
            details: retryResponseText,
            status: retryResponse.status
          }), {
            status: retryResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const retryResult = JSON.parse(retryResponseText);
        console.log("✅ Payment created (retry with PIX):", retryResult.id);
        
        return await processPaymentResult(retryResult, serviceClient, pre_enrollment_id, enrollment_id, isEnrollmentCheckout, checkoutFee, checkoutKind, checkoutReason, prePaidTotal, environment, corsHeaders);
      }

      // No fallback possible - return error
      return new Response(JSON.stringify({ 
        error: "Falha ao criar pagamento",
        details: paymentResponseText,
        status: paymentResponse.status
      }), {
        status: paymentResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment succeeded - parse and process
    const paymentResult = JSON.parse(paymentResponseText);
    console.log("✅ Payment created:", paymentResult.id);

    return await processPaymentResult(paymentResult, serviceClient, pre_enrollment_id, enrollment_id, isEnrollmentCheckout, checkoutFee, checkoutKind, checkoutReason, prePaidTotal, environment, corsHeaders);

  } catch (error: any) {
    console.error("💥 Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error?.message || "Unknown error",
        stack: error?.stack?.substring(0, 500),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function processPaymentResult(
  paymentResult: any,
  serviceClient: any,
  pre_enrollment_id: string,
  enrollment_id: string | null,
  isEnrollmentCheckout: boolean,
  checkoutFee: number,
  checkoutKind: string,
  checkoutReason: string,
  prePaidTotal: number,
  environment: string,
  corsHeaders: Record<string, string>
) {
  // Store payment in database
  try {
    const paymentInsertData: any = {
      pre_enrollment_id: pre_enrollment_id,
      amount: checkoutFee,
      currency: "BRL",
      status: "pending",
      kind: checkoutKind,
      asaas_payment_id: paymentResult.id,
    };

    if (isEnrollmentCheckout && enrollment_id) {
      paymentInsertData.enrollment_id = enrollment_id;
    }

    const { error: insertError } = await serviceClient
      .from("payments")
      .insert(paymentInsertData);

    if (insertError) {
      console.error("Error storing payment:", insertError);
    } else {
      console.log("✅ Payment stored in database");
    }
  } catch (dbError) {
    console.error("DB error storing payment:", dbError);
  }

  // Update pre-enrollment or enrollment status
  try {
    if (isEnrollmentCheckout && enrollment_id) {
      await serviceClient
        .from("enrollments")
        .update({
          enrollment_payment_id: paymentResult.id,
          enrollment_amount: checkoutFee,
        })
        .eq("id", enrollment_id);
    } else {
      await serviceClient
        .from("pre_enrollments")
        .update({ status: "waiting_payment" })
        .eq("id", pre_enrollment_id);
    }
  } catch (updateError) {
    console.error("Error updating status:", updateError);
  }

  // Build invoice URL - Asaas provides invoiceUrl in the response
  const invoiceUrl = paymentResult.invoiceUrl || 
    `https://${environment === "production" ? "www.asaas.com" : "sandbox.asaas.com"}/i/${paymentResult.id}`;

  console.log("🔗 Invoice URL:", invoiceUrl);

  return new Response(
    JSON.stringify({
      checkout_url: invoiceUrl, // Keep for backwards compatibility
      invoice_url: invoiceUrl,
      payment_id: paymentResult.id,
      checkout_id: paymentResult.id, // Keep for backwards compatibility
      applied_amount: checkoutFee,
      reason: checkoutReason,
      pre_paid_total: prePaidTotal,
      billing_type: paymentResult.billingType,
      due_date: paymentResult.dueDate,
      pix_qr_code_url: paymentResult.pixQrCodeUrl || null,
      bank_slip_url: paymentResult.bankSlipUrl || null,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
}
