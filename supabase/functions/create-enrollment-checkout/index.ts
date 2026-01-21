import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize both clients - anon for auth check, service for data queries
  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    console.log("🚀 Edge function started");

    // Parse the request body - accept both pre_enrollment_id and enrollment_id
    const body = await req.json();
    console.log("📦 Request body:", JSON.stringify(body));

    const { pre_enrollment_id, enrollment_id, force_recalculate, override_amount } = body;

    if (!pre_enrollment_id) {
      console.error("Missing pre_enrollment_id in request");
      return new Response(JSON.stringify({ error: "pre_enrollment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Se force_recalculate=true, forçar recriação do checkout para aplicar desconto
    const forceRecalculate = force_recalculate === true;
    if (forceRecalculate) {
      console.log("🔄 force_recalculate=true - Forçando recálculo do checkout com desconto");
    }

    // Se override_amount foi passado, usar esse valor diretamente (não calcular)
    // Aceita number OU string numérica (ex: "380", "380.00")
    const overrideAmountNumber = typeof override_amount === "number" ? override_amount : Number(override_amount);
    const hasOverrideAmount = Number.isFinite(overrideAmountNumber) && overrideAmountNumber > 0;
    if (hasOverrideAmount) {
      console.log(`💵 override_amount=${override_amount} (parsed=${overrideAmountNumber}) - Usando valor direto sem cálculo dinâmico`);
    }

    // Determine if this is for pre-enrollment or enrollment
    const isEnrollmentCheckout = !!enrollment_id;
    console.log(`Processing ${isEnrollmentCheckout ? "enrollment" : "pre-enrollment"} checkout`);
    console.log(`Pre-enrollment ID: ${pre_enrollment_id}${enrollment_id ? `, Enrollment ID: ${enrollment_id}` : ""}`);

    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    console.log("🔐 Authorization header present:", !!authHeader);
    console.log("🔐 Authorization header prefix:", authHeader?.substring(0, 15) || "null");

    if (!authHeader) {
      console.error("❌ No authorization header provided");
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Robust token extraction - handles "Bearer", "bearer", extra spaces
    const headerLower = authHeader.toLowerCase();
    if (!headerLower.startsWith("bearer ")) {
      console.error("❌ Malformed Authorization header - does not start with 'Bearer '");
      console.error("Header starts with:", authHeader.substring(0, 20));
      return new Response(
        JSON.stringify({ 
          error: "Malformed Authorization header",
          hint: "Expected format: 'Bearer <token>'"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract token using split to handle any whitespace variations
    const parts = authHeader.split(/\s+/);
    const token = parts[1]?.trim();
    
    if (!token || token.split('.').length !== 3) {
      console.error("❌ Invalid JWT format - token parts:", token?.split('.').length || 0);
      return new Response(
        JSON.stringify({ 
          error: "Invalid token format",
          hint: "JWT must have 3 parts separated by dots"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("🔐 Token extracted - length:", token.length, "parts:", token.split('.').length);

    // Validate JWT using getClaims() - works without active session lookup
    // This validates the token locally and extracts claims without network call
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      console.error("❌ getClaims error:", JSON.stringify(authError || { message: "No claims found" }));
      return new Response(
        JSON.stringify({
          error: "Invalid authentication",
          details: authError?.message || "Token validation failed",
          code: (authError as any)?.code || "AUTH_ERROR",
          hint: "Token may be expired or invalid"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract user ID from claims
    const userId = claimsData.claims.sub as string;
    if (!userId) {
      console.error("❌ No user ID (sub) in token claims");
      console.error("Claims received:", JSON.stringify(claimsData.claims));
      return new Response(
        JSON.stringify({ error: "Invalid token - no user ID" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`✅ Authenticated user: ${userId}`);
    console.log(`✅ Token expires at: ${new Date((claimsData.claims.exp as number) * 1000).toISOString()}`);
    
    // Create a user-like object for compatibility with rest of code
    const user = { id: userId, email: claimsData.claims.email as string };

    // Get payment settings using serviceClient to bypass RLS
    console.log("💳 Fetching payment settings...");
    const { data: paymentSettings, error: settingsError } = await serviceClient
      .from("payment_settings")
      .select("environment, asaas_api_key_sandbox, asaas_api_key_production")
      .maybeSingle();

    console.log("Payment settings result:", {
      found: !!paymentSettings,
      error: settingsError?.message,
      environment: paymentSettings?.environment,
    });

    if (settingsError) {
      console.error("Payment settings database error:", settingsError);
      return new Response(
        JSON.stringify({
          error: "Erro ao buscar configurações de pagamento. Entre em contato com o suporte.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!paymentSettings) {
      console.error("Payment settings not configured - table is empty");
      return new Response(
        JSON.stringify({
          error:
            "Sistema de pagamento não configurado. O administrador precisa configurar as credenciais do Asaas primeiro.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get the appropriate API key based on environment
    // Normalize to avoid issues like "Produção", "PRODUCTION", etc.
    const rawEnvironment = (paymentSettings.environment ?? "sandbox").toString().toLowerCase().trim();
    const environment =
      rawEnvironment === "production" ||
      rawEnvironment === "prod" ||
      rawEnvironment === "producao" ||
      rawEnvironment === "produção"
        ? "production"
        : "sandbox";

    const asaasApiKey =
      environment === "production" ? paymentSettings.asaas_api_key_production : paymentSettings.asaas_api_key_sandbox;

    if (!asaasApiKey) {
      console.error(`Asaas API key not configured for environment: ${environment}`);
      return new Response(JSON.stringify({ error: `API key not configured for ${environment} environment` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pre-enrollment data using service client to bypass RLS
    console.log("📚 Fetching pre-enrollment:", pre_enrollment_id);
    const { data: preEnrollment, error: preEnrollmentError } = await serviceClient
      .from("pre_enrollments")
      .select(
        `
        *,
        courses (
          name,
          asaas_title,
          pre_enrollment_fee,
          enrollment_fee,
          discounted_enrollment_fee
        )
      `,
      )
      .eq("id", pre_enrollment_id)
      .single();

    console.log("Pre-enrollment fetch result:", {
      found: !!preEnrollment,
      error: preEnrollmentError?.message,
    });

    // Get enrollment data if enrollment_id is provided
    let enrollment = null;

    if (isEnrollmentCheckout) {
      const { data: enrollmentData, error: enrollmentError } = await serviceClient
        .from("enrollments")
        .select("*")
        .eq("id", enrollment_id)
        .single();

      if (enrollmentError || !enrollmentData) {
        console.error("Enrollment query failed:", enrollmentError);
        console.error("Enrollment ID:", enrollment_id);
        return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate ownership
      if (enrollmentData.user_id !== user.id) {
        console.error(
          `User ${user.id} attempted to access enrollment ${enrollment_id} owned by ${enrollmentData.user_id}`,
        );
        return new Response(JSON.stringify({ error: "Acesso não autorizado à matrícula" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      enrollment = enrollmentData;
    }

    // Get user profile data as fallback
    const { data: userProfile } = await serviceClient.from("profiles").select("*").eq("user_id", user.id).single();

    // Validate pre-enrollment exists BEFORE accessing its properties
    if (preEnrollmentError || !preEnrollment) {
      console.error("Pre-enrollment query failed:", preEnrollmentError);
      console.error("Pre-enrollment ID:", pre_enrollment_id);
      return new Response(JSON.stringify({ error: "Pré-matrícula não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate ownership
    if (preEnrollment.user_id !== user.id) {
      console.error(
        `User ${user.id} attempted to access pre-enrollment ${pre_enrollment_id} owned by ${preEnrollment.user_id}`,
      );
      return new Response(JSON.stringify({ error: "Acesso não autorizado à pré-matrícula" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Pre-enrollment found for course: ${preEnrollment.courses?.name || "UNKNOWN"}`);

    // ETAPA 1: Verificar se já existe um pagamento pendente
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

    // REGRA ANTI-REUSO INDEVIDO: Se override_amount foi passado, comparar com o checkout existente
    if (existingPayment && hasOverrideAmount) {
      const existingAmount = Number(existingPayment.amount || 0);
      const tolerance = 0.5; // R$ 0,50 de tolerância
      
      if (Math.abs(existingAmount - overrideAmountNumber) > tolerance) {
        console.log(`⚠️ ANTI-REUSO: Checkout existente R$ ${existingAmount} difere do override R$ ${overrideAmountNumber}`);
        console.log(`📛 Cancelando checkout antigo ${existingPayment.id} para criar novo com valor correto...`);
        
        await serviceClient
          .from("payments")
          .update({ status: 'cancelled' })
          .eq("id", existingPayment.id);
        
        // Não reutilizar - continuar para criar novo checkout
      } else {
        // Valores iguais (dentro da tolerância), pode reutilizar
        console.log(`✅ Checkout existente R$ ${existingAmount} corresponde ao override R$ ${overrideAmountNumber}, reutilizando...`);
        const checkoutUrl = `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
        return new Response(
          JSON.stringify({
            checkout_url: checkoutUrl,
            checkout_id: existingPayment.asaas_payment_id,
            reused: true,
            applied_amount: existingAmount,
            override_received: override_amount,
            override_parsed: overrideAmountNumber,
            used_override: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
    } else if (existingPayment && !forceRecalculate) {
      console.log("Found existing payment:", existingPayment.id);

      // Para checkout de matrícula, verificar se há crédito de pré-matrícula que não foi aplicado
      if (isEnrollmentCheckout) {
        const { data: confirmedPrePayment } = await serviceClient
          .from("payments")
          .select("amount")
          .eq("pre_enrollment_id", pre_enrollment_id)
          .eq("kind", "pre_enrollment")
          .in("status", ["confirmed", "received"])
          .maybeSingle();

        if (confirmedPrePayment?.amount) {
          const prePaymentAmount = Number(confirmedPrePayment.amount);
          const existingPaymentAmount = Number(existingPayment.amount);
          const originalFee = preEnrollment.courses?.enrollment_fee || 0;
          
          // Se o checkout existente tem o valor cheio (sem desconto aplicado), cancelar e criar novo
          if (existingPaymentAmount >= originalFee - 1) { // tolerância de R$ 1
            console.log("⚠️ Checkout antigo encontrado com valor cheio, mas há crédito de pré-matrícula R$", prePaymentAmount);
            console.log("📛 Cancelando checkout antigo e criando novo com desconto...");
            
            await serviceClient
              .from("payments")
              .update({ status: 'cancelled' })
              .eq("id", existingPayment.id);
            
            // Não retornar - continuar para criar novo checkout com desconto
          } else {
            // Checkout já tem desconto aplicado, reutilizar
            console.log("✅ Checkout existente já tem desconto aplicado, reutilizando...");
            const checkoutUrl = `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
            return new Response(
              JSON.stringify({
                checkout_url: checkoutUrl,
                checkout_id: existingPayment.asaas_payment_id,
                reused: true,
                applied_amount: existingPaymentAmount,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              },
            );
          }
        } else {
          // Sem crédito de pré-matrícula, reutilizar checkout existente
          console.log("Reusing existing payment (no pre-enrollment credit):", existingPayment.id);
          const checkoutUrl = `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
          return new Response(
            JSON.stringify({
              checkout_url: checkoutUrl,
              checkout_id: existingPayment.asaas_payment_id,
              reused: true,
              applied_amount: Number(existingPayment.amount),
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            },
          );
        }
      } else {
        // Checkout de pré-matrícula, reutilizar normalmente
        console.log("Reusing existing pre-enrollment payment:", existingPayment.id);
        const checkoutUrl = `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${existingPayment.asaas_payment_id}`;
        return new Response(
          JSON.stringify({
            checkout_url: checkoutUrl,
            checkout_id: existingPayment.asaas_payment_id,
            reused: true,
            applied_amount: Number(existingPayment.amount),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
    } else if (existingPayment && forceRecalculate) {
      // Forçar recálculo - cancelar checkout antigo
      console.log("🔄 force_recalculate=true - Cancelando checkout antigo:", existingPayment.id);
      await serviceClient
        .from("payments")
        .update({ status: 'cancelled' })
        .eq("id", existingPayment.id);
    }

    // ETAPA 2: Validar dados do curso
    if (!preEnrollment.courses) {
      console.error("Course data not found for pre-enrollment:", pre_enrollment_id);
      return new Response(
        JSON.stringify({
          error: "Dados do curso não encontrados. Entre em contato com o suporte.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Determine which fee to use based on checkout type
    const originalEnrollmentFee = preEnrollment.courses.enrollment_fee || 0;
    const discountedFeeFromDB = preEnrollment.courses.discounted_enrollment_fee;
    const preEnrollmentFeeDB = preEnrollment.courses.pre_enrollment_fee || 0;
    
    let checkoutFee = isEnrollmentCheckout
      ? originalEnrollmentFee
      : preEnrollmentFeeDB;

    const feeType = isEnrollmentCheckout ? "matrícula" : "pré-matrícula";
    let preEnrollmentDiscount = 0;

    // ========== ESTRATÉGIA DE DESCONTO PARA MATRÍCULA ==========
    // NOVA ABORDAGEM: Calcular AMBOS os candidatos e escolher o MENOR
    // 1. candidateFromDB = discounted_enrollment_fee (se existir)
    // 2. candidateFromPayments = original - soma_pagamentos_confirmados
    // 3. Escolher o menor (mais favorável ao aluno)
    // ============================================================
    
    // Variáveis para audit payload
    let discountReason = "full_price";
    let prePaidTotal = 0;
    let candidateFromDB = 0;
    let candidateFromPayments = 0;
    
    if (isEnrollmentCheckout) {
      console.log("📊 ========== CÁLCULO DO DESCONTO DE MATRÍCULA ==========");
      console.log(`   📋 VALOR ORIGINAL DA MATRÍCULA: R$ ${originalEnrollmentFee}`);
      console.log(`   📋 VALOR COM DESCONTO (DB): R$ ${discountedFeeFromDB ?? 'NÃO DEFINIDO'}`);
      console.log(`   📋 TAXA DE PRÉ-MATRÍCULA: R$ ${preEnrollmentFeeDB}`);
      console.log(`   📋 Status pré-matrícula: ${preEnrollment.status}`);
      console.log(`   📋 Aprovação manual: ${preEnrollment.manual_approval}`);
      
      const preEnrollmentConfirmed = preEnrollment.status === 'payment_confirmed' || 
                                      preEnrollment.status === 'enrolled' ||
                                      preEnrollment.status === 'waiting_organ_approval';
      
      // PASSO 1: Calcular candidato do banco (se disponível)
      if (discountedFeeFromDB && discountedFeeFromDB > 0 && preEnrollmentConfirmed) {
        candidateFromDB = Math.max(discountedFeeFromDB, 5);
        console.log(`   💾 Candidato do banco: R$ ${candidateFromDB}`);
      }
      
      // PASSO 2: SEMPRE buscar pagamentos confirmados na tabela payments
      console.log("🔍 Buscando pagamentos de pré-matrícula confirmados na tabela payments...");
      
      let { data: confirmedPayments, error: paymentsError } = await serviceClient
        .from("payments")
        .select("amount, status, created_at")
        .eq("pre_enrollment_id", pre_enrollment_id)
        .eq("kind", "pre_enrollment")
        .in("status", ["confirmed", "received"]);

      if (paymentsError) {
        console.error("❌ Erro ao buscar pagamentos:", paymentsError);
      }

      prePaidTotal = confirmedPayments?.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      ) ?? 0;

      console.log(`   💳 Pagamentos encontrados: ${confirmedPayments?.length || 0}`);
      confirmedPayments?.forEach((p, i) => {
        console.log(`      [${i+1}] R$ ${p.amount} - status: ${p.status} - data: ${p.created_at}`);
      });
      console.log(`   💰 TOTAL PRÉ PAGO (payments table): R$ ${prePaidTotal}`);

      // AUTO-HEAL para aprovações manuais sem registro de pagamento
      if (
        prePaidTotal === 0 &&
        preEnrollment.manual_approval === true &&
        preEnrollmentConfirmed &&
        preEnrollmentFeeDB > 0
      ) {
        console.log("🔧 AUTO-HEAL: Aprovação manual detectada sem registro de pagamento.");
        
        const { data: existingHeal } = await serviceClient
          .from("payments")
          .select("id")
          .eq("pre_enrollment_id", pre_enrollment_id)
          .eq("kind", "pre_enrollment")
          .in("status", ["confirmed", "received"])
          .maybeSingle();

        if (!existingHeal) {
          const { data: healedPayment, error: healError } = await serviceClient
            .from("payments")
            .insert({
              pre_enrollment_id: pre_enrollment_id,
              amount: preEnrollmentFeeDB,
              currency: "BRL",
              status: "confirmed",
              kind: "pre_enrollment",
              asaas_payment_id: `autoheal_${pre_enrollment_id}_${Date.now()}`,
              paid_at: new Date().toISOString()
            })
            .select()
            .single();

          if (healError) {
            console.error("❌ AUTO-HEAL: Falha ao criar pagamento:", healError);
          } else {
            console.log("✅ AUTO-HEAL: Pagamento criado:", healedPayment.id);
            prePaidTotal = preEnrollmentFeeDB;
          }
        }
      }
      
      // FALLBACK: Se pré-matrícula confirmada mas sem pagamento, usar taxa de pré-matrícula
      if (prePaidTotal === 0 && preEnrollmentConfirmed && preEnrollmentFeeDB > 0) {
        console.log("⚠️ FALLBACK: Pré-matrícula confirmada sem pagamento registrado.");
        console.log(`   Usando taxa de pré-matrícula como crédito: R$ ${preEnrollmentFeeDB}`);
        prePaidTotal = preEnrollmentFeeDB;
      }

      // Calcular candidato baseado em pagamentos
      if (prePaidTotal > 0) {
        candidateFromPayments = Math.max(originalEnrollmentFee - prePaidTotal, 5);
        console.log(`   💳 Candidato dos pagamentos: R$ ${candidateFromPayments}`);
      }

      // PASSO 3: DECISÃO FINAL - escolher o MENOR valor válido
      console.log("🎯 DECISÃO FINAL:");
      console.log(`   📊 Candidato do banco: R$ ${candidateFromDB || 'N/A'}`);
      console.log(`   📊 Candidato dos pagamentos: R$ ${candidateFromPayments || 'N/A'}`);
      
      if (candidateFromDB > 0 && candidateFromPayments > 0) {
        // AMBOS disponíveis - escolher o MENOR (mais favorável)
        if (candidateFromPayments <= candidateFromDB) {
          checkoutFee = candidateFromPayments;
          preEnrollmentDiscount = prePaidTotal;
          discountReason = "payments_total";
          console.log(`   ✅ ESCOLHIDO: Pagamentos (menor) - R$ ${checkoutFee}`);
        } else {
          checkoutFee = candidateFromDB;
          preEnrollmentDiscount = originalEnrollmentFee - candidateFromDB;
          discountReason = "db_discounted_fee";
          console.log(`   ✅ ESCOLHIDO: Banco (menor) - R$ ${checkoutFee}`);
        }
      } else if (candidateFromPayments > 0) {
        // Só pagamentos disponíveis
        checkoutFee = candidateFromPayments;
        preEnrollmentDiscount = prePaidTotal;
        discountReason = "payments_total";
        console.log(`   ✅ ESCOLHIDO: Pagamentos (único disponível) - R$ ${checkoutFee}`);
      } else if (candidateFromDB > 0) {
        // Só banco disponível
        checkoutFee = candidateFromDB;
        preEnrollmentDiscount = originalEnrollmentFee - candidateFromDB;
        discountReason = "db_discounted_fee";
        console.log(`   ✅ ESCOLHIDO: Banco (único disponível) - R$ ${checkoutFee}`);
      } else {
        // Nenhum desconto disponível
        discountReason = "no_credit_full_price";
        console.log("ℹ️ Nenhum crédito de pré-matrícula encontrado - cobrando valor cheio");
      }
      
      console.log(`   ✂️ DESCONTO TOTAL: R$ ${preEnrollmentDiscount}`);
      console.log(`   💵 VALOR FINAL: R$ ${checkoutFee}`);
      console.log(`   📝 RAZÃO: ${discountReason}`);
      console.log("📊 ========================================================");
    }

    console.log(`Checkout fee for ${feeType}:`, checkoutFee);

    // ========== OVERRIDE AMOUNT (mantido para compatibilidade) ==========
    if (hasOverrideAmount) {
      console.log(`🔒 OVERRIDE: Substituindo checkoutFee de R$ ${checkoutFee} por R$ ${overrideAmountNumber}`);
      checkoutFee = Math.max(overrideAmountNumber, 5);
      console.log(`🔒 OVERRIDE: Valor final do checkout: R$ ${checkoutFee}`);
    }
    // ======================================================================

    if (!checkoutFee || checkoutFee <= 0) {
      console.error(`Course ${feeType} fee not configured:`, {
        courseId: preEnrollment.course_id,
        courseName: preEnrollment.courses.name,
        pre_enrollment_fee: preEnrollment.courses.pre_enrollment_fee,
        enrollment_fee: preEnrollment.courses.enrollment_fee,
        fee: checkoutFee,
        type: feeType,
        isEnrollmentCheckout,
      });
      return new Response(
        JSON.stringify({
          error: `Taxa de ${feeType} não configurada para este curso. Entre em contato com o suporte.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Helper function to clean and validate phone number
    const cleanPhone = (phone: string | null): string => {
      if (!phone) return "11999999999"; // Valid São Paulo number as fallback
      const cleaned = phone.replace(/\D/g, "");

      // Must have at least 10 digits (landline) or 11 digits (mobile)
      if (cleaned.length >= 10 && cleaned.length <= 11) {
        return cleaned;
      }

      return "11999999999"; // Valid São Paulo number as fallback
    };

    // Helper function to clean and validate postal code
    const cleanPostalCode = (postalCode: string | null): string => {
      if (!postalCode) return "01310200"; // Valid São Paulo CEP as fallback
      const cleaned = postalCode.replace(/\D/g, "");

      // Must have exactly 8 digits
      if (cleaned.length === 8) {
        return cleaned;
      }

      return "01310200"; // Valid São Paulo CEP as fallback
    };

    // Helper function to clean CPF
    const cleanCPF = (cpf: string | null): string => {
      if (!cpf) return "00000000000";
      const cleaned = cpf.replace(/\D/g, "");

      // Must have exactly 11 digits
      if (cleaned.length === 11) {
        return cleaned;
      }

      return "00000000000";
    };

    // Helper function to truncate name to Asaas limit (SEM adicionar "...")
    const truncateName = (name: string, maxLength: number = 30): string => {
      const trimmed = name.trim(); // Remove espaços extras primeiro
      if (trimmed.length <= maxLength) return trimmed;
      return trimmed.substring(0, maxLength); // SEM os "..."
    };

    // Helper function to get value with fallback from profile
    const getValueWithFallback = (preEnrollmentValue: any, profileValue: any, defaultValue: any) => {
      return preEnrollmentValue || profileValue || defaultValue;
    };

    console.log("Preparing customer data with validation...");
    console.log("Pre-enrollment data:", {
      whatsapp: preEnrollment.whatsapp,
      postal_code: preEnrollment.postal_code,
      cpf: preEnrollment.cpf,
      address: preEnrollment.address,
      state: preEnrollment.state,
      city: preEnrollment.city,
    });

    console.log(
      "Profile data:",
      userProfile
        ? {
            whatsapp: userProfile.whatsapp,
            postal_code: userProfile.postal_code,
            cpf: userProfile.cpf,
            address: userProfile.address,
            state: userProfile.state,
            city: userProfile.city,
          }
        : "No profile data",
    );

    // Create Asaas checkout following official documentation
    const origin = req.headers.get("origin") || "https://6be1b209-32ae-497f-88c1-5af12f9e3bfe.lovableproject.com";
    console.log("🌐 Origin header:", origin);

    const redirectPath = isEnrollmentCheckout ? "/student/enrollments" : "/student/pre-enrollments";
    const courseName = "Licenca Capacitacao"; // Sempre fixo para Asaas
    const itemDescription = isEnrollmentCheckout ? "Matricula" : "Pre-Matricula";

    console.log("📝 Preparando dados do checkout...");
    console.log("   Item description:", itemDescription);
    console.log("   Course name:", preEnrollment.courses.name);
    console.log("   Checkout fee:", checkoutFee);

    // Pré-matrícula: SEMPRE apenas PIX
    // Matrícula (valor cheio ou com desconto): TODOS os métodos em produção
    const allowedBillingTypes = isEnrollmentCheckout
      ? (environment === "production" 
          ? ["CREDIT_CARD", "PIX", "BOLETO"] 
          : ["PIX"]) // Sandbox = só PIX para evitar erros
      : ["PIX"]; // Pré-matrícula = sempre PIX

    console.log(`🔄 Tipo: ${isEnrollmentCheckout ? 'MATRÍCULA' : 'PRÉ-MATRÍCULA'} | Ambiente: ${environment} | billingTypes: ${JSON.stringify(allowedBillingTypes)}`);

    const checkoutData = {
      billingTypes: allowedBillingTypes,
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
          description: itemDescription, // Já é curto o suficiente ('Matricula' ou 'Pre-Matricula')
          name: courseName, // Sempre 'Licenca Capacitacao' (20 caracteres)
          quantity: 1,
          value: checkoutFee,
        },
      ],
      customerData: {
        name: truncateName(getValueWithFallback(preEnrollment.full_name, userProfile?.full_name, "Nome não informado")),
        cpfCnpj: cleanCPF(getValueWithFallback(preEnrollment.cpf, userProfile?.cpf, null)),
        email: getValueWithFallback(preEnrollment.email, userProfile?.email, "email@exemplo.com"),
        phone: cleanPhone(getValueWithFallback(preEnrollment.whatsapp, userProfile?.whatsapp, null)),
        address: truncateName(
          getValueWithFallback(preEnrollment.address, userProfile?.address, "Rua não informada"),
          60,
        ),
        addressNumber: getValueWithFallback(preEnrollment.address_number, userProfile?.address_number, "S/N"),
        postalCode: cleanPostalCode(getValueWithFallback(preEnrollment.postal_code, userProfile?.postal_code, null)),
        province: truncateName(getValueWithFallback(preEnrollment.state, userProfile?.state, "SP"), 30),
        city: truncateName(getValueWithFallback(preEnrollment.city, userProfile?.city, "São Paulo"), 40),
      },
    };

    console.log("=== VALIDAÇÃO DE LIMITES ASAAS ===");
    console.log("items[0].name length:", checkoutData.items[0].name.length, "- Value:", checkoutData.items[0].name);
    console.log(
      "items[0].description length:",
      checkoutData.items[0].description.length,
      "- Value:",
      checkoutData.items[0].description,
    );
    console.log(
      "customerData.name length:",
      checkoutData.customerData.name.length,
      "- Value:",
      checkoutData.customerData.name,
    );
    console.log(
      "customerData.address length:",
      checkoutData.customerData.address.length,
      "- Value:",
      checkoutData.customerData.address,
    );
    console.log(
      "customerData.province length:",
      checkoutData.customerData.province.length,
      "- Value:",
      checkoutData.customerData.province,
    );
    console.log(
      "customerData.city length:",
      checkoutData.customerData.city.length,
      "- Value:",
      checkoutData.customerData.city,
    );
    console.log("=================================");

    console.log("📤 Dados completos do checkout:");
    console.log(JSON.stringify(checkoutData, null, 2));

    // ========================================
    // VALIDAÇÃO COMPLETA ANTES DO ENVIO ASAAS
    // ========================================
    
    const validateCheckoutData = (data: any): string[] => {
      const errors: string[] = [];
      
      // Validar items[0]
      if (data.items[0].name.length > 30) {
        errors.push(`items[0].name excede 30 chars: "${data.items[0].name}" (${data.items[0].name.length} chars)`);
      }
      if (data.items[0].description.length > 30) {
        errors.push(`items[0].description excede 30 chars: "${data.items[0].description}" (${data.items[0].description.length} chars)`);
      }
      
      // Validar customerData - ASAAS EXIGE MÁXIMO DE 30 CHARS PARA TODOS OS CAMPOS "name"
      if (data.customerData.name.length > 30) {
        errors.push(`customerData.name excede 30 chars: "${data.customerData.name}" (${data.customerData.name.length} chars)`);
      }
      if (data.customerData.address.length > 60) {
        errors.push(`customerData.address excede 60 chars: "${data.customerData.address}" (${data.customerData.address.length} chars)`);
      }
      if (data.customerData.province.length > 30) {
        errors.push(`customerData.province excede 30 chars: "${data.customerData.province}" (${data.customerData.province.length} chars)`);
      }
      if (data.customerData.city.length > 40) {
        errors.push(`customerData.city excede 40 chars: "${data.customerData.city}" (${data.customerData.city.length} chars)`);
      }
      if (data.customerData.cpfCnpj.length !== 11 && data.customerData.cpfCnpj.length !== 14) {
        errors.push(`customerData.cpfCnpj deve ter 11 ou 14 dígitos: "${data.customerData.cpfCnpj}" (${data.customerData.cpfCnpj.length} chars)`);
      }
      if (data.customerData.postalCode.length !== 8) {
        errors.push(`customerData.postalCode deve ter 8 dígitos: "${data.customerData.postalCode}" (${data.customerData.postalCode.length} chars)`);
      }
      if (data.customerData.phone.length < 10 || data.customerData.phone.length > 11) {
        errors.push(`customerData.phone deve ter 10 ou 11 dígitos: "${data.customerData.phone}" (${data.customerData.phone.length} chars)`);
      }
      
      return errors;
    };
    
    console.log("=== VALIDAÇÃO FINAL ANTES DO ENVIO À ASAAS ===");
    const validationErrors = validateCheckoutData(checkoutData);
    
    if (validationErrors.length > 0) {
      console.error("❌ ERROS DE VALIDAÇÃO ENCONTRADOS:");
      validationErrors.forEach((error, index) => {
        console.error(`   ${index + 1}. ${error}`);
      });
      
      // Aplicar correções automáticas
      console.log("🔧 Aplicando correções automáticas...");
      
      if (checkoutData.items[0].name.length > 30) {
        checkoutData.items[0].name = "Licenca Capacitacao";
        console.log("   ✅ items[0].name corrigido para:", checkoutData.items[0].name);
      }
      
      if (checkoutData.items[0].description.length > 30) {
        checkoutData.items[0].description = checkoutData.items[0].description.substring(0, 30);
        console.log("   ✅ items[0].description corrigido para:", checkoutData.items[0].description);
      }
      
      if (checkoutData.customerData.name.length > 30) {
        checkoutData.customerData.name = checkoutData.customerData.name.substring(0, 30);
        console.log("   ✅ customerData.name corrigido para:", checkoutData.customerData.name);
      }
      
      if (checkoutData.customerData.address.length > 60) {
        checkoutData.customerData.address = checkoutData.customerData.address.substring(0, 60);
        console.log("   ✅ customerData.address corrigido para:", checkoutData.customerData.address);
      }
      
      if (checkoutData.customerData.province.length > 30) {
        checkoutData.customerData.province = checkoutData.customerData.province.substring(0, 30);
        console.log("   ✅ customerData.province corrigido para:", checkoutData.customerData.province);
      }
      
      if (checkoutData.customerData.city.length > 40) {
        checkoutData.customerData.city = checkoutData.customerData.city.substring(0, 40);
        console.log("   ✅ customerData.city corrigido para:", checkoutData.customerData.city);
      }
      
      // Re-validar após correções
      const revalidationErrors = validateCheckoutData(checkoutData);
      if (revalidationErrors.length > 0) {
        console.error("❌ AINDA HÁ ERROS APÓS CORREÇÃO AUTOMÁTICA:");
        revalidationErrors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`);
        });
        
        return new Response(
          JSON.stringify({
            error: "Dados inválidos para checkout",
            details: revalidationErrors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
    
    console.log("✅ Todos os campos validados com sucesso!");
    console.log("courseName usado:", courseName);
    console.log("items[0].name:", checkoutData.items[0].name, `(${checkoutData.items[0].name.length} chars)`);
    console.log("items[0].description:", checkoutData.items[0].description, `(${checkoutData.items[0].description.length} chars)`);
    console.log("customerData.name:", checkoutData.customerData.name, `(${checkoutData.customerData.name.length} chars)`);
    console.log("customerData.address:", checkoutData.customerData.address, `(${checkoutData.customerData.address.length} chars)`);
    console.log("customerData.province:", checkoutData.customerData.province, `(${checkoutData.customerData.province.length} chars)`);
    console.log("customerData.city:", checkoutData.customerData.city, `(${checkoutData.customerData.city.length} chars)`);
    console.log("customerData.cpfCnpj:", checkoutData.customerData.cpfCnpj, `(${checkoutData.customerData.cpfCnpj.length} chars)`);
    console.log("customerData.postalCode:", checkoutData.customerData.postalCode, `(${checkoutData.customerData.postalCode.length} chars)`);
    console.log("customerData.phone:", checkoutData.customerData.phone, `(${checkoutData.customerData.phone.length} chars)`);
    console.log("============================================");

    // ✅ VALIDAÇÃO CRÍTICA FINAL - FORÇAR 30 CHARS PARA TODOS OS CAMPOS "name"
    console.log("🔒 VALIDAÇÃO CRÍTICA FINAL - Garantindo limites Asaas...");
    
    // Forçar limite de 30 caracteres para TODOS os campos "name"
    if (checkoutData.items[0].name.length > 30) {
      console.error("❌ CRÍTICO: items[0].name ainda excede 30 chars!");
      checkoutData.items[0].name = checkoutData.items[0].name.substring(0, 30);
    }
    
    if (checkoutData.items[0].description.length > 30) {
      console.error("❌ CRÍTICO: items[0].description ainda excede 30 chars!");
      checkoutData.items[0].description = checkoutData.items[0].description.substring(0, 30);
    }
    
    if (checkoutData.customerData.name.length > 30) {
      console.error("❌ CRÍTICO: customerData.name ainda excede 30 chars!");
      checkoutData.customerData.name = checkoutData.customerData.name.substring(0, 30);
    }
    
    // Log final dos campos validados
    console.log("✅ VALIDAÇÃO FINAL COMPLETA:");
    console.log("   items[0].name:", checkoutData.items[0].name, `(${checkoutData.items[0].name.length} chars)`);
    console.log("   items[0].description:", checkoutData.items[0].description, `(${checkoutData.items[0].description.length} chars)`);
    console.log("   customerData.name:", checkoutData.customerData.name, `(${checkoutData.customerData.name.length} chars)`);
    
    // Garantir que NENHUM campo excede os limites
    if (checkoutData.items[0].name.length > 30 || 
        checkoutData.items[0].description.length > 30 || 
        checkoutData.customerData.name.length > 30) {
      console.error("❌ FALHA CRÍTICA: Campos ainda excedem limites após correção!");
      return new Response(
        JSON.stringify({
          error: "Erro interno: não foi possível validar dados do checkout",
          details: "Campos excedem limites da API Asaas"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use the configured environment from settings
    const asaasApiUrl =
      environment === "production"
        ? "https://api.asaas.com/v3/checkouts"
        : "https://sandbox.asaas.com/api/v3/checkouts";

    console.log(`Using Asaas API URL: ${asaasApiUrl} (environment: ${environment})`);

    let checkoutResult;
    try {
      console.log("🔄 Chamando API Asaas...");
      
      // Log COMPLETO do que está sendo enviado
      const requestBody = JSON.stringify(checkoutData);
      console.log("📤 REQUEST BODY COMPLETO:");
      console.log(requestBody);
      console.log("📊 TAMANHO DO REQUEST:", requestBody.length, "bytes");
      
      const asaasResponse = await fetch(asaasApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: requestBody,
      });

      const responseText = await asaasResponse.text();

      console.log("📊 Asaas API Response Status:", asaasResponse.status);
      console.log("📊 Asaas API Response Headers:", JSON.stringify(Object.fromEntries(asaasResponse.headers)));
      console.log("📊 Asaas API Response Body:", responseText);

      if (!asaasResponse.ok) {
        console.error("❌ ASAAS API ERROR:");
        console.error("   Status:", asaasResponse.status);
        console.error("   Response:", responseText);

        // Tentar parsear o erro para extrair detalhes
        try {
          const errorData = JSON.parse(responseText);
          console.error("   Parsed Error:", JSON.stringify(errorData, null, 2));
          console.error("❌ ASAAS API error:", JSON.stringify(errorData));
          
          if (errorData.errors) {
            errorData.errors.forEach((err: any, index: number) => {
              console.error(`   Error ${index + 1}:`, err);
              console.error(`      Code: ${err.code}`);
              console.error(`      Description: ${err.description}`);
            });
            
            // Se o erro for sobre o campo "name", mostrar TODOS os campos "name" enviados
            const hasNameError = errorData.errors.some((err: any) => 
              err.description && err.description.includes('name')
            );
            
            if (hasNameError) {
              console.error("🔍 DETALHAMENTO DOS CAMPOS 'NAME' ENVIADOS:");
              console.error("   items[0].name:", checkoutData.items[0].name, `(${checkoutData.items[0].name.length} chars)`);
              console.error("   items[0].description:", checkoutData.items[0].description, `(${checkoutData.items[0].description.length} chars)`);
              console.error("   customerData.name:", checkoutData.customerData.name, `(${checkoutData.customerData.name.length} chars)`);
            }
          }
        } catch (parseError) {
          console.error("   Could not parse error response");
        }

        return new Response(
          JSON.stringify({
            error: "Failed to create checkout",
            details: responseText,
            status: asaasResponse.status,
          }),
          {
            // Preserve upstream status code to make debugging and handling easier.
            status: asaasResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      checkoutResult = JSON.parse(responseText);
      console.log("✅ Asaas checkout criado com sucesso:", checkoutResult.id);
    } catch (error) {
      console.error("💥 Exception ao chamar API Asaas:", error);
      if (error instanceof Error) {
        console.error("   Error name:", error.name);
        console.error("   Error message:", error.message);
        console.error("   Error stack:", error.stack);
      }
      throw error;
    }
    console.log("Asaas checkout response:", checkoutResult);

    // ETAPA 3: Store checkout info in payments table with try-catch
    try {
      const paymentInsertData: any = {
        pre_enrollment_id: pre_enrollment_id,
        amount: checkoutFee,
        currency: "BRL",
        status: "pending",
        kind: checkoutKind,
        asaas_payment_id: checkoutResult.id,
      };

      if (isEnrollmentCheckout && enrollment_id) {
        paymentInsertData.enrollment_id = enrollment_id;
      }

      const { data: newPayment, error: paymentError } = await serviceClient
        .from("payments")
        .insert(paymentInsertData)
        .select()
        .single();

      if (paymentError) {
        console.error("Error storing payment:", paymentError);
        // Não falhar a requisição, apenas logar o erro
        // O checkout do Asaas já foi criado com sucesso
      } else {
        console.log("Payment record created:", newPayment.id);

        // Update enrollment with payment reference AND enrollment_amount if this is an enrollment checkout
        if (isEnrollmentCheckout && enrollment_id) {
          const updateData: any = { enrollment_payment_id: checkoutResult.id };
          
          // Persistir o valor final da matrícula (com desconto aplicado)
          updateData.enrollment_amount = checkoutFee;
          console.log(`💾 Persistindo enrollment_amount = R$ ${checkoutFee} na matrícula ${enrollment_id}`);
          
          const { error: updateError } = await serviceClient
            .from("enrollments")
            .update(updateData)
            .eq("id", enrollment_id);

          if (updateError) {
            console.error("Error updating enrollment with payment ID and amount:", updateError);
          } else {
            console.log("✅ Enrollment atualizado com enrollment_amount:", checkoutFee);
          }
        }
      }
    } catch (paymentInsertError) {
      console.error("Exception storing payment:", paymentInsertError);
      // Continuar mesmo com erro, pois o checkout já foi criado
    }

    // Construct checkout URL if not provided directly
    const checkoutUrl =
      checkoutResult.url ||
      `https://${environment === "production" ? "asaas.com" : "sandbox.asaas.com"}/checkoutSession/show?id=${checkoutResult.id}`;

    if (!checkoutResult.id) {
      console.error("Asaas did not return checkout ID:", checkoutResult);
      return new Response(JSON.stringify({ error: "Failed to create checkout - no ID returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calcular desconto aplicado para retornar ao frontend
    const originalFee = isEnrollmentCheckout ? (preEnrollment.courses?.enrollment_fee || 0) : (preEnrollment.courses?.pre_enrollment_fee || 0);
    const discountApplied = originalFee - checkoutFee;

    console.log("✅ RESPOSTA FINAL:");
    console.log(`   applied_amount: R$ ${checkoutFee}`);
    console.log(`   reason: ${discountReason}`);
    console.log(`   pre_paid_total: R$ ${prePaidTotal}`);
    console.log(`   candidate_from_db: R$ ${candidateFromDB}`);
    console.log(`   candidate_from_payments: R$ ${candidateFromPayments}`);

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        checkout_id: checkoutResult.id,
        original_fee: originalFee,
        discount: discountApplied > 0 ? discountApplied : 0,
        final_amount: checkoutFee,
        // AUDITORIA: Campos extras para debug/confirmação
        applied_amount: checkoutFee,
        reason: discountReason,
        pre_paid_total: prePaidTotal,
        candidate_from_db: candidateFromDB,
        candidate_from_payments: candidateFromPayments,
        discounted_fee_db: discountedFeeFromDB || null,
        pre_enrollment_fee_db: preEnrollmentFeeDB,
        override_received: override_amount,
        override_parsed: overrideAmountNumber,
        used_override: hasOverrideAmount,
        reused: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("💥 Unexpected error:", error);
    
    // Enhanced error logging for debugging
    let errorMessage = "Internal server error";
    let errorDetails = "Unknown error";
    let errorStack = "";
    
    if (error instanceof Error) {
      console.error("💥 Error name:", error.name);
      console.error("💥 Error message:", error.message);
      console.error("💥 Error stack:", error.stack);
      errorMessage = error.message || errorMessage;
      errorDetails = error.name || "Error";
      errorStack = error.stack || "";
    } else if (typeof error === "string") {
      console.error("💥 Error string:", error);
      errorMessage = error;
    } else {
      console.error("💥 Error object:", JSON.stringify(error));
      try {
        errorDetails = JSON.stringify(error);
      } catch {
        errorDetails = String(error);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        details: errorDetails,
        stack: errorStack.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
        hint: "Check Edge Function logs for full details"
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
