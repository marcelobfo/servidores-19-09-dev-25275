// arquivo: edge_create_checkout.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ASAAS_MAX_LENGTH = 200; // <- altere aqui se quiser outro limite
const ASAAS_TIMEOUT_MS = 20000; // timeout para chamadas a Asaas (ms)

/** Helpers utilitários */
const safeTrim = (s: any) => (typeof s === "string" ? s.trim() : "");

const truncateName = (name: string | undefined | null, maxLength: number = ASAAS_MAX_LENGTH): string => {
  const trimmed = safeTrim(name ?? "");
  if (trimmed.length <= maxLength) return trimmed;
  // preserva espaço para '...'
  return trimmed.substring(0, Math.max(0, maxLength - 3)) + "...";
};

const cleanDigits = (s: string | null | undefined) => (s ? String(s).replace(/\D/g, "") : "");

const cleanPhone = (phone: string | null | undefined): string => {
  const cleaned = cleanDigits(phone);
  // aceitável: 10 (fixo) ou 11 (celular). Se maior, guarda últimos 11 (DDI+DDD?) — mas fallback para SP válido
  if (cleaned.length === 10 || cleaned.length === 11) return cleaned;
  if (cleaned.length > 11) return cleaned.slice(-11);
  return "11999999999"; // fallback válido
};

const cleanPostalCode = (postalCode: string | null | undefined): string => {
  const cleaned = cleanDigits(postalCode);
  if (cleaned.length === 8) return cleaned;
  return "01310200";
};

const cleanCPF = (cpf: string | null | undefined): string => {
  const cleaned = cleanDigits(cpf);
  if (cleaned.length === 11) return cleaned;
  return "00000000000";
};

const getValueWithFallback = (primary: any, fallback: any, defaultValue: any) => primary ?? fallback ?? defaultValue;

/** Entrypoint */
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Inicializa clientes Supabase
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    console.log("🚀 Edge function started");

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Bad JSON body:", e);
      return new Response(JSON.stringify({ error: "Request body inválido" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { pre_enrollment_id, enrollment_id } = body;
    if (!pre_enrollment_id) {
      return new Response(JSON.stringify({ error: "pre_enrollment_id is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const isEnrollmentCheckout = !!enrollment_id;

    // Auth header
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    // Verifica usuário via anon client
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid authentication", details: authError.message }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const user = authData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication - no user found" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    console.log("✅ Authenticated user:", user.id);

    // Busca configurações de pagamento (usa service role para bypass RLS)
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from("payment_settings")
      .select("environment, asaas_api_key_sandbox, asaas_api_key_production")
      .maybeSingle();

    if (settingsError) {
      console.error("Payment settings error:", settingsError);
      return new Response(JSON.stringify({ error: "Erro ao buscar configurações de pagamento" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!paymentSettings) {
      return new Response(JSON.stringify({ error: "Sistema de pagamento não configurado" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const environment = paymentSettings.environment ?? "sandbox";
    const asaasApiKey =
      environment === "production" ? paymentSettings.asaas_api_key_production : paymentSettings.asaas_api_key_sandbox;
    if (!asaasApiKey) {
      console.error("Asaas API key missing for environment:", environment);
      return new Response(JSON.stringify({ error: `API key not configured for ${environment}` }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Busca pre-enrollment (bypass RLS)
    const { data: preEnrollment, error: preEnrollmentError } = await serviceClient
      .from("pre_enrollments")
      .select(
        `
        *,
        courses (
          id,
          name,
          asaas_title,
          pre_enrollment_fee,
          enrollment_fee
        )
      `,
      )
      .eq("id", pre_enrollment_id)
      .single();

    if (preEnrollmentError || !preEnrollment) {
      console.error("Pre-enrollment not found:", preEnrollmentError);
      return new Response(JSON.stringify({ error: "Pré-matrícula não encontrada" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Se for checkout de matrícula, busca enrollment e valida ownership
    let enrollment: any = null;
    if (isEnrollmentCheckout) {
      const { data: enrollmentData, error: enrollmentError } = await serviceClient
        .from("enrollments")
        .select("*")
        .eq("id", enrollment_id)
        .single();

      if (enrollmentError || !enrollmentData) {
        console.error("Enrollment not found:", enrollmentError);
        return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (enrollmentData.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Acesso não autorizado à matrícula" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      enrollment = enrollmentData;
    }

    // Perfil do usuário (fallbacks)
    const { data: userProfile } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Valida curso e taxa
    const course = preEnrollment.courses;
    if (!course) {
      return new Response(JSON.stringify({ error: "Dados do curso não encontrados" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const checkoutFee = isEnrollmentCheckout ? course.enrollment_fee || 0 : course.pre_enrollment_fee || 0;
    const feeType = isEnrollmentCheckout ? "matrícula" : "pré-matrícula";
    if (!checkoutFee || checkoutFee <= 0) {
      console.error("Checkout fee invalid:", { courseId: preEnrollment.course_id, fee: checkoutFee });
      return new Response(JSON.stringify({ error: `Taxa de ${feeType} não configurada para este curso` }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Verifica se existe pagamento pendente (reusar)
    let paymentQuery = serviceClient
      .from("payments")
      .select("id, status, asaas_payment_id")
      .eq("pre_enrollment_id", pre_enrollment_id)
      .eq("kind", isEnrollmentCheckout ? "enrollment" : "pre_enrollment")
      .in("status", ["pending", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (isEnrollmentCheckout && enrollment_id) paymentQuery = paymentQuery.eq("enrollment_id", enrollment_id);

    const { data: existingPayment } = await paymentQuery.maybeSingle();
    if (existingPayment) {
      const checkoutUrl = `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
      return new Response(
        JSON.stringify({
          checkout_url: checkoutUrl,
          checkout_id: existingPayment.asaas_payment_id,
          reused: true,
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Monta dados do checkout (com truncamentos centralizados)
    const origin = req.headers.get("origin") || "";
    const redirectPath = isEnrollmentCheckout ? "/student/enrollments" : "/student/pre-enrollments";
    const courseName = 'Licenca Capacitacao'; // Sempre fixo - 20 caracteres

    const itemDescription = isEnrollmentCheckout ? 'Matricula' : 'Pre-Matricula'; // Sempre fixo - 9-13 caracteres

    const checkoutData = {
      billingTypes: ["CREDIT_CARD", "PIX", "BOLETO"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${origin}${redirectPath}?payment_success=true`,
        cancelUrl: `${origin}${redirectPath}?payment_cancelled=true`,
        expiredUrl: `${origin}${redirectPath}?payment_expired=true`,
      },
      items: [
        {
          externalReference: isEnrollmentCheckout ? enrollment_id : pre_enrollment_id,
          description: itemDescription, // Já é curto o suficiente
          name: 'Licenca Capacitacao', // Fixo - 20 caracteres
          quantity: 1,
          value: checkoutFee,
        },
      ],
      customerData: {
        name: truncateName(
          getValueWithFallback(preEnrollment.full_name, userProfile?.full_name, "Nome não informado"),
          ASAAS_MAX_LENGTH,
        ),
        cpfCnpj: cleanCPF(getValueWithFallback(preEnrollment.cpf, userProfile?.cpf, null)),
        email: getValueWithFallback(preEnrollment.email, userProfile?.email, "email@exemplo.com"),
        phone: cleanPhone(getValueWithFallback(preEnrollment.whatsapp, userProfile?.whatsapp, null)),
        address: truncateName(
          getValueWithFallback(preEnrollment.address, userProfile?.address, "Rua não informada"),
          60,
        ),
        addressNumber: getValueWithFallback(preEnrollment.address_number, userProfile?.address_number, "S/N"),
        postalCode: cleanPostalCode(getValueWithFallback(preEnrollment.postal_code, userProfile?.postal_code, null)),
        province: truncateName(getValueWithFallback(preEnrollment.state, userProfile?.state, "SP"), ASAAS_MAX_LENGTH),
        city: truncateName(getValueWithFallback(preEnrollment.city, userProfile?.city, "São Paulo"), 40),
      },
    };

    console.log('=== VALIDAÇÃO FINAL ANTES DO ENVIO ===');
    console.log('items[0].name:', checkoutData.items[0].name, '| Length:', checkoutData.items[0].name.length);
    console.log('items[0].description:', checkoutData.items[0].description, '| Length:', checkoutData.items[0].description.length);
    console.log('customerData.name:', checkoutData.customerData.name, '| Length:', checkoutData.customerData.name.length);
    
    // Validação extra de segurança - garantir limites
    if (checkoutData.items[0].name.length > 30) {
      console.error('❌ CRÍTICO: items[0].name excede 30 chars:', checkoutData.items[0].name);
      checkoutData.items[0].name = 'Licenca Capacitacao';
    }
    if (checkoutData.items[0].description.length > 30) {
      console.error('❌ CRÍTICO: items[0].description excede 30 chars:', checkoutData.items[0].description);
      checkoutData.items[0].description = checkoutData.items[0].description.substring(0, 30);
    }
    if (checkoutData.customerData.name.length > 100) {
      console.error('❌ CRÍTICO: customerData.name excede 100 chars:', checkoutData.customerData.name);
      checkoutData.customerData.name = checkoutData.customerData.name.substring(0, 100);
    }
    console.log('======================================');

    const asaasApiUrl =
      environment === "production"
        ? "https://api.asaas.com/v3/checkouts"
        : "https://sandbox.asaas.com/api/v3/checkouts";

    // Chamada a Asaas
    let checkoutResult: any = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ASAAS_TIMEOUT_MS);

      const asaasResponse = await fetch(asaasApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify(checkoutData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await asaasResponse.text();
      console.log("Asaas status:", asaasResponse.status);
      console.log("Asaas body:", responseText);

      if (!asaasResponse.ok) {
        let parsed = null;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          // não conseguiu parsear
        }
        console.error("Asaas returned error:", parsed ?? responseText);
        return new Response(
          JSON.stringify({
            error: "Failed to create checkout",
            details: parsed ?? responseText,
            status: asaasResponse.status,
          }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      checkoutResult = JSON.parse(responseText);
      if (!checkoutResult || !checkoutResult.id) {
        console.error("Asaas returned no id:", checkoutResult);
        return new Response(JSON.stringify({ error: "Failed to create checkout - no ID returned" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      console.log("✅ Asaas checkout created:", checkoutResult.id);
    } catch (err) {
      console.error("Exception calling Asaas:", err);
      return new Response(JSON.stringify({ error: "Exception calling Asaas", details: String(err) }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Insere registro de pagamento (não falhar caso dê erro)
    try {
      const paymentInsertData: any = {
        pre_enrollment_id,
        amount: checkoutFee,
        currency: "BRL",
        status: "pending",
        kind: isEnrollmentCheckout ? "enrollment" : "pre_enrollment",
        asaas_payment_id: checkoutResult.id,
      };
      if (isEnrollmentCheckout && enrollment_id) paymentInsertData.enrollment_id = enrollment_id;

      const { data: newPayment, error: paymentError } = await serviceClient
        .from("payments")
        .insert(paymentInsertData)
        .select()
        .single();

      if (paymentError) {
        console.error("Error storing payment:", paymentError);
      } else {
        console.log("Payment record created:", newPayment?.id ?? newPayment);
        if (isEnrollmentCheckout && enrollment_id) {
          const { error: updateError } = await serviceClient
            .from("enrollments")
            .update({ enrollment_payment_id: checkoutResult.id })
            .eq("id", enrollment_id);
          if (updateError) console.error("Error updating enrollment with payment ID:", updateError);
        }
      }
    } catch (err) {
      console.error("Exception storing payment:", err);
      // continuar
    }

    const checkoutUrl =
      checkoutResult.url ??
      `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${checkoutResult.id}`;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        checkout_id: checkoutResult.id,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
