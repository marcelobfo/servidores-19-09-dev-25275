import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
serve(async (req) => {
  console.log("🚀 generate-course-image-v2 function started");
  if (req.method === "OPTIONS") {
    console.log("✅ CORS preflight request handled");
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  try {
    const { courseName, areaName, description } = await req.json();
    console.log("📥 Request received:", {
      courseName,
      areaName,
      hasDescription: !!description,
    });
    if (!courseName) {
      console.error("Course name is required");
      return new Response(
        JSON.stringify({
          error: "Nome do curso é obrigatório",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    // ✅ Usa chave da API Gemini configurada no ambiente
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("Gemini API key not configured");
      return new Response(
        JSON.stringify({
          error: "Configuração do sistema incompleta. Defina GEMINI_API_KEY no ambiente.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    console.log("Using Google Gemini API for image generation");
    // 🔹 Cria prompt descritivo
    const prompt = `
Crie uma capa de curso educacional moderna e profissional:

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ""}
${description ? `Descrição: ${description}` : ""}

Estilo: design gráfico profissional, cores vibrantes e elegantes, composição equilibrada, visual inspirador.
Formato 16:9, alta resolução, sem texto.
`;
    console.log("🧠 Prompt:", prompt);
    // 🔹 Requisição para Gemini (modelo de imagem)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0:generateImage?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: {
            text: prompt,
          },
          aspectRatio: "16:9",
        }),
      },
    );
    console.log("Gemini API status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar imagem com a API Gemini.",
          details: errorText,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    const data = await response.json();
    console.log("Gemini response received:", JSON.stringify(data, null, 2));
    // 🔹 Extrai imagem base64
    const imageBase64 = data.images?.[0]?.image || null;
    if (!imageBase64) {
      console.error("❌ Nenhuma imagem retornada pelo Gemini");
      return new Response(
        JSON.stringify({
          error: "A API Gemini não retornou nenhuma imagem válida.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    console.log("✅ Image generated successfully");
    return new Response(
      JSON.stringify({
        imageUrl: `data:image/png;base64,${imageBase64}`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("💥 Error in generate-course-image-v2:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno ao gerar imagem",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
