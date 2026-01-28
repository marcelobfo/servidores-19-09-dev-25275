import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URLS CORRIGIDAS
const DEFAULT_SANDBOX_URL = "https://sandbox.asaas.com/api/v3";
const DEFAULT_PRODUCTION_URL = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const { pre_enrollment_id, enrollment_id, kind: bodyKind } = body;

    if (!pre_enrollment_id) throw new Error("pre_enrollment_id is required");

    // 1. Configurações
    const { data: settings } = await serviceClient.from("payment_settings").select("*").single();
    if (!settings) throw new Error("Configurações de pagamento não encontradas");

    const isProd = settings.environment === "production";
    const asaasApiKey = isProd ? settings.asaas_api_key_production : settings.asaas_api_key_sandbox;
    const asaasApiUrl = isProd ? DEFAULT_PRODUCTION_URL : DEFAULT_SANDBOX_URL;

    // 2. Dados do Aluno
    const { data: preEnrollment } = await serviceClient
      .from("pre_enrollments")
      .select("*, courses(*)")
      .eq("id", pre_enrollment_id)
      .single();

    if (!preEnrollment) throw new Error("Pré-matrícula não encontrada");

    // 3. Lógica de Valor e Tipo (Kind)
    const isMatricula = !!enrollment_id || bodyKind === "enrollment";
    const checkoutFee = isMatricula
      ? preEnrollment.courses?.discounted_enrollment_fee || preEnrollment.courses?.enrollment_fee
      : preEnrollment.courses?.pre_enrollment_fee;

    // AQUI LIBERA CARTÃO E BOLETO:
    // Se for pré-matrícula: PIX. Se for Matrícula: UNDEFINED (libera tudo)
    const billingType = isMatricula ? "UNDEFINED" : "PIX";

    // 4. Criar Cliente no Asaas (Com CPF Limpo)
    const customerRes = await fetch(`${asaasApiUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: asaasApiKey },
      body: JSON.stringify({
        name: preEnrollment.full_name,
        email: preEnrollment.email,
        cpfCnpj: preEnrollment.cpf?.replace(/\D/g, ""),
        phone: preEnrollment.whatsapp?.replace(/\D/g, ""),
      }),
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok) throw new Error(`Erro Cliente Asaas: ${JSON.stringify(customerData)}`);

    // 5. Criar Pagamento
    const paymentRes = await fetch(`${asaasApiUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: asaasApiKey },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: billingType,
        value: checkoutFee,
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
        description: `${isMatricula ? "Matrícula" : "Pré-Matrícula"} - ${preEnrollment.courses?.name}`,
        externalReference: pre_enrollment_id,
      }),
    });

    const paymentResult = await paymentRes.json();
    if (!paymentRes.ok) throw new Error(`Erro Pagamento Asaas: ${JSON.stringify(paymentResult)}`);

    // 6. Salvar no Banco
    await serviceClient.from("payments").insert({
      pre_enrollment_id,
      enrollment_id: enrollment_id || null,
      amount: checkoutFee,
      status: "pending",
      kind: isMatricula ? "enrollment" : "pre_enrollment",
      asaas_payment_id: paymentResult.id,
    });

    return new Response(
      JSON.stringify({
        checkout_url: paymentResult.invoiceUrl,
        payment_id: paymentResult.id,
        billing_type: paymentResult.billingType,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("💥 Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
