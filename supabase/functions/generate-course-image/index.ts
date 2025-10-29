import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch gemini_api_key from system_settings
    console.log('📡 Fetching Gemini API key from system_settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('gemini_api_key')
      .single();

    if (settingsError || !settings?.gemini_api_key) {
      console.error('❌ Gemini API key not found in system_settings:', settingsError);
      return new Response(JSON.stringify({ 
        error: 'Chave da API do Gemini não configurada. Configure em Sistema > Integração com IA (Gemini).' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const GEMINI_API_KEY = settings.gemini_api_key;
    console.log('✅ Gemini API key found:', GEMINI_API_KEY.substring(0, 10) + '...');

    // Validate API key format
    if (!GEMINI_API_KEY.startsWith('AIza')) {
      console.error('❌ Invalid Gemini API key format');
      return new Response(JSON.stringify({ 
        error: 'Chave da API do Gemini inválida. A chave deve começar com "AIza".' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    // Call Google Gemini API for image generation
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`;
    console.log('🌐 Calling Gemini Imagen API...');

    const requestBody = {
      instances: [{
        prompt: fullPrompt
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9"
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Gemini API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:');
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
          error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' 
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      if (response.status === 400) {
        return new Response(JSON.stringify({ 
          error: 'Chave da API do Gemini inválida ou modelo não disponível.',
          details: errorDetails?.error?.message || errorText
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      if (response.status === 404) {
        return new Response(JSON.stringify({ 
          error: 'Modelo de geração de imagens não encontrado.',
          hint: 'Verifique se a API key tem permissões para geração de imagens'
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao gerar imagem com o Gemini.',
        details: errorDetails?.error?.message || errorText,
        status: response.status
      }), { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const data = await response.json();
    console.log('📦 Full Gemini response structure:', JSON.stringify(data, null, 2));

    // Extract image from response (Imagen API format)
    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
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

    console.log('✅ Image generated successfully');

    const imageUrl = `data:image/png;base64,${imageBase64}`;

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
