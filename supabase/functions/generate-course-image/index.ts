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
    
    // Criar cliente Supabase para buscar a API key do Gemini
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar gemini_api_key da tabela system_settings
    console.log('Fetching Gemini API key from system_settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('gemini_api_key')
      .single();
    
    if (settingsError || !settings?.gemini_api_key) {
      console.error('Gemini API key not found:', settingsError);
      return new Response(
        JSON.stringify({ 
          error: 'Chave da API do Gemini não configurada. Configure em Sistema > Integração com IA (Gemini).' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const GEMINI_API_KEY = settings.gemini_api_key;
    console.log('Gemini API key found:', GEMINI_API_KEY.substring(0, 10) + '...');

    // Build context-aware prompt based on type
    let fullPrompt = "";
    
    if (type === "course" && courseName) {
      fullPrompt = `Create a modern, professional course banner image for "${courseName}"${areaName ? ` in the ${areaName} area` : ''}. 
      Style: Dark purple/magenta gradient background with abstract 3D shapes, modern tech aesthetic, vibrant colors, high quality, professional. 
      Include subtle abstract elements that represent learning and technology. 
      The image should be suitable as a hero banner for an online course. Ultra high resolution. 16:9 aspect ratio.`;
    } else if (type === "grid") {
      fullPrompt = `Create a modern promotional banner for multiple online courses. 
      Style: Dark purple/magenta gradient background, abstract 3D geometric shapes floating, vibrant tech aesthetic, modern design. 
      Include elements that represent education, innovation, and digital learning. 
      Professional, high quality, ultra high resolution. 16:9 aspect ratio.`;
    } else if (prompt) {
      fullPrompt = prompt;
    } else {
      throw new Error('Invalid parameters');
    }

    console.log('Generating image with prompt:', fullPrompt);
    
    // Chamar API direta do Google Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt
            }
          ]
        }
      ]
    };
    
    console.log('Calling Google Gemini API...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      
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
          error: 'Chave da API do Gemini inválida. Verifique a configuração em Sistema.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao gerar imagem com o Gemini.',
        details: errorText,
        status: response.status
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log('Google Gemini response received');
    
    // Extrair imagem do formato do Google Gemini
    const imageBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!imageBase64) {
      console.error('Failed to extract image from response');
      console.error('Response structure:', JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({ 
        error: 'Nenhuma imagem foi gerada pela IA.',
        details: 'A resposta da API não contém dados de imagem'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Adicionar prefixo data:image/png;base64,
    const imageUrl = `data:image/png;base64,${imageBase64}`;
    
    console.log('Image generated successfully');

    return new Response(JSON.stringify({ 
      imageUrl,
      prompt: fullPrompt 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-course-image:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
