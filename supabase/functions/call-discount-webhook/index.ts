import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", function: "call-discount-webhook" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("📨 [DISCOUNT-WEBHOOK-PROXY] Recebendo requisição...");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Sem header de autorização");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with user auth for validation
    const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Usuário não autenticado:", userError);
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ [DISCOUNT-WEBHOOK-PROXY] Usuário autenticado:", user.id);

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get payload from request
    const payload = await req.json();
    console.log("📦 [DISCOUNT-WEBHOOK-PROXY] Payload recebido:", JSON.stringify(payload, null, 2));

    // Fetch webhook URL from system_settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("discount_checkout_webhook_url")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Erro ao buscar settings:", settingsError);
      return new Response(JSON.stringify({ error: "Erro ao buscar configurações" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = settings?.discount_checkout_webhook_url;
    if (!webhookUrl) {
      console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Webhook URL não configurada");
      return new Response(JSON.stringify({ error: "Webhook URL não configurada nas configurações do sistema" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("🔗 [DISCOUNT-WEBHOOK-PROXY] Chamando webhook:", webhookUrl);

    // Fetch Asaas settings
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("asaas_environment, asaas_api_key, asaas_sandbox_api_key")
      .maybeSingle();

    const asaasEnvironment = paymentSettings?.asaas_environment || 'sandbox';
    const asaasApiKey = asaasEnvironment === 'production'
      ? paymentSettings?.asaas_api_key
      : paymentSettings?.asaas_sandbox_api_key;
    const asaasBaseUrl = asaasEnvironment === 'production'
      ? 'https://api.asaas.com/'
      : 'https://api-sandbox.asaas.com/';

    console.log("🔑 [DISCOUNT-WEBHOOK-PROXY] Asaas Environment:", asaasEnvironment);
    console.log("🌐 [DISCOUNT-WEBHOOK-PROXY] Asaas Base URL:", asaasBaseUrl);

    // Add Asaas config to payload
    const enrichedPayload = {
      ...payload,
      asaas: {
        api_key: asaasApiKey || '',
        environment: asaasEnvironment,
        base_url: asaasBaseUrl,
      },
    };

    // Call the N8N webhook (server-side, no CORS issues)
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(enrichedPayload),
    });

    console.log("📬 [DISCOUNT-WEBHOOK-PROXY] Webhook response status:", webhookResponse.status);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Webhook retornou erro:", errorText);
      return new Response(JSON.stringify({ 
        error: "Erro na resposta do webhook", 
        details: errorText,
        status: webhookResponse.status 
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookData = await webhookResponse.json();
    console.log("✅ [DISCOUNT-WEBHOOK-PROXY] Resposta do webhook:", JSON.stringify(webhookData, null, 2));

    // Return the checkout_url from N8N
    return new Response(JSON.stringify(webhookData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ [DISCOUNT-WEBHOOK-PROXY] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
