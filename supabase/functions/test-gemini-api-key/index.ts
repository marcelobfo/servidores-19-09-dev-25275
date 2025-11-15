import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "API Key não fornecida" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate API key format (Google AI Studio keys start with "AIza")
    if (!apiKey.startsWith('AIza')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Formato de API Key inválido. Chaves do Google AI Studio devem começar com 'AIza'" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Test API key with a simple text generation request
    const startTime = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Responda apenas: OK"
            }]
          }]
        })
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      let message = "Erro ao validar API Key";
      
      if (response.status === 400) {
        message = "API Key inválida ou mal formatada";
      } else if (response.status === 403) {
        message = "API Key sem permissões suficientes";
      } else if (response.status === 429) {
        message = "Rate limit atingido. Tente novamente em alguns segundos";
      } else if (response.status === 404) {
        message = "Modelo Gemini não encontrado";
      }

      console.error('Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          message,
          details: {
            status: response.status,
            error: errorData
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();

    // Check if we got a valid response
    if (!data.candidates || !data.candidates[0]?.content) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Resposta inválida da API do Gemini" 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `API Key válida! Tempo de resposta: ${responseTime}ms`,
        details: {
          model: 'gemini-2.0-flash-lite',
          responseTime
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in test-gemini-api-key function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : "Erro desconhecido ao testar API Key" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
