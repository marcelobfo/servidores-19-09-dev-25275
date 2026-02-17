import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  console.log('🚀 generate-course-image function started');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, type = "course", courseName, areaName } = await req.json();
    console.log('📥 Request received:', { type, courseName, areaName, hasPrompt: !!prompt });

    // Get Lovable API key (automatically available in Supabase environment)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('❌ LOVABLE_API_KEY not found');
      return new Response(JSON.stringify({ 
        error: 'Chave da API do Lovable AI não está configurada.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Lovable API key found');

    // Build context-aware prompt based on type
    let fullPrompt = "";
    
    if (type === "course" && courseName) {
      fullPrompt = `Crie uma capa de curso educacional moderna e profissional para "${courseName}"${areaName ? ` na área de ${areaName}` : ''}. 
      Estilo: design gráfico profissional com gradiente roxo/magenta escuro, formas 3D abstratas, estética tech moderna, cores vibrantes, alta qualidade, profissional. 
      Inclua elementos abstratos sutis que representem aprendizado e tecnologia. 
      A imagem deve ser adequada como banner hero para um curso online. Ultra alta resolução. Proporção 16:9.`;
    } else if (type === "grid") {
      fullPrompt = `Crie um banner promocional moderno para múltiplos cursos online. 
      Estilo: gradiente roxo/magenta escuro de fundo, formas geométricas 3D abstratas flutuantes, estética tech vibrante, design moderno. 
      Inclua elementos que representem educação, inovação e aprendizado digital. 
      Profissional, alta qualidade, ultra alta resolução. Proporção 16:9.`;
    } else if (prompt) {
      fullPrompt = prompt;
    } else {
      console.error('❌ Invalid parameters');
      return new Response(JSON.stringify({ 
        error: 'Parâmetros inválidos. Forneça courseName ou prompt.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🧠 Full prompt:', fullPrompt);

    // Call Lovable AI for image generation
    const lovableUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    console.log('🌐 Calling Lovable AI for image generation...');

    const requestBody = {
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        { role: "user", content: fullPrompt }
      ],
      modalities: ["image", "text"]
    };

    const response = await fetch(lovableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Lovable AI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:');
      console.error('📍 Status:', response.status);
      console.error('📍 Status Text:', response.statusText);
      console.error('📍 Error Body:', errorText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        console.error('📍 Error Details JSON:', JSON.stringify(errorDetails, null, 2));
      } catch {
        console.error('📍 Error is not JSON format');
      }

      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requisições do Lovable AI atingido. Tente novamente em alguns instantes.' 
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Créditos insuficientes no Lovable AI. Adicione créditos em Settings > Workspace > Usage.',
          details: errorDetails?.error?.message || errorText
        }), { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      if (response.status === 400) {
        return new Response(JSON.stringify({ 
          error: 'Requisição inválida para o Lovable AI.',
          details: errorDetails?.error?.message || errorText
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao gerar imagem com o Lovable AI.',
        details: errorDetails?.error?.message || errorText,
        status: response.status
      }), { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const data = await response.json();
    console.log('📦 Full Lovable AI response structure:', JSON.stringify(data, null, 2));

    // Extract image from response (Lovable AI format)
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('❌ No image data in response');
      return new Response(JSON.stringify({ 
        error: 'Nenhuma imagem foi gerada pela IA.',
        details: 'A resposta da API não contém dados de imagem',
        responseStructure: data
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Image generated successfully with Lovable AI');

    return new Response(JSON.stringify({ 
      imageUrl,
      prompt: fullPrompt 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in generate-course-image:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno ao gerar imagem'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
