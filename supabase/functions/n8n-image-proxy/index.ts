const N8N_WEBHOOK_URL = "https://automacao-n8n.w3lidv.easypanel.host/webhook/servidores_imagem";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📤 Forwarding to N8N:", JSON.stringify(body));

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("📥 N8N response status:", response.status);
    const contentType = response.headers.get("content-type") || "";
    console.log("📥 N8N content-type:", contentType);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ N8N returned error:", response.status, errorBody);
      return new Response(JSON.stringify({ 
        error: "Erro no serviço de geração de imagem (N8N)", 
        details: errorBody,
        n8nStatus: response.status 
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If N8N returns binary image data directly
    if (contentType.startsWith("image/")) {
      console.log("🖼️ N8N returned binary image, converting to base64...");
      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const dataUri = `data:${contentType.split(";")[0]};base64,${base64}`;
      return new Response(JSON.stringify({ imageUrl: dataUri }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise treat as JSON
    const data = await response.json();
    console.log("📥 N8N JSON response keys:", Object.keys(data));
    console.log("📥 N8N imageUrl starts with:", data?.imageUrl?.substring?.(0, 80));

    // If imageUrl is raw base64 (no data: prefix), add it
    if (data?.imageUrl && !data.imageUrl.startsWith("data:") && !data.imageUrl.startsWith("http")) {
      console.log("🔧 Raw base64 detected, adding data URI prefix...");
      data.imageUrl = `data:image/png;base64,${data.imageUrl}`;
    }

    return new Response(JSON.stringify(data), {
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
