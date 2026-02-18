const N8N_WEBHOOK_URL = "https://automacao-n8n.w3lidv.easypanel.host/webhook/servidores_imagem";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📤 Forwarding to N8N:", JSON.stringify(body));

    // Fire-and-forget: send to N8N but don't wait for image response
    // N8N will save the image directly to Supabase storage and update the course record
    fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(response => {
      console.log("📥 N8N response status:", response.status);
      if (!response.ok) {
        console.error("❌ N8N returned error:", response.status);
      } else {
        console.log("✅ N8N accepted the request successfully");
      }
    }).catch(error => {
      console.error("❌ Error sending to N8N:", error.message);
    });

    // Return immediately - N8N will update the course record directly in the database
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Solicitação enviada. A imagem será gerada e salva automaticamente.",
      courseId: body.courseId 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in n8n-image-proxy:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
