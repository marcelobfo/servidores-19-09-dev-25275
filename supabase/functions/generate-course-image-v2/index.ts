import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  console.log('🚀 generate-course-image-v2 function started');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, areaName, description } = await req.json();
    console.log('📥 Request received:', { courseName, areaName, hasDescription: !!description });

    if (!courseName) {
      console.error('Course name is required');
      return new Response(
        JSON.stringify({ error: 'Nome do curso é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase para buscar a API key do Gemini
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar gemini_api_key da tabela system_settings
    console.log('Fetching Gemini API key from system_settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('gemini_api_key')
      .limit(1)
      .maybeSingle();
    
    if (settingsError || !settings?.gemini_api_key) {
      console.error('❌ Gemini API key not found:', settingsError);
      return new Response(
        JSON.stringify({ 
          error: 'Chave da API do Gemini não configurada. Configure em Sistema > Integração com IA (Gemini).' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const GEMINI_API_KEY = settings.gemini_api_key;
    console.log('✅ Gemini API key found:', GEMINI_API_KEY.substring(0, 10) + '...');
    
    // Validar formato da API key
    if (!GEMINI_API_KEY.startsWith('AIza')) {
      console.error('❌ Invalid Gemini API key format. Key should start with "AIza"');
      return new Response(
        JSON.stringify({ 
          error: 'Chave da API do Gemini inválida. A chave deve começar com "AIza". Verifique a configuração em Sistema.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt otimizado para capa de curso (Imagen 3)
    const prompt = `Crie uma capa de curso profissional e moderna com proporção 16:9.

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ''}
${description ? `Descrição: ${description}` : ''}

Estilo: Design gráfico de curso online, cores vibrantes porém elegantes, ícones e elementos educacionais, iluminação suave, composição equilibrada. A imagem deve parecer uma thumbnail premium de curso em plataforma de ensino.`;

    console.log('🎨 Generating image for course:', courseName);

    // Chamar API do Gemini 2.0 Flash (suporta geração de imagens)
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    };
    
    console.log('📤 Calling Gemini 2.0 Flash API for image generation...');

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Gemini response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Imagen API error:');
      console.error('📍 Status:', response.status);
      console.error('📍 Status Text:', response.statusText);
      console.error('📍 Error Body:', errorText);
      console.error('📍 Model:', 'gemini-2.0-flash-exp');
      
      // Tentar parsear como JSON para mais detalhes
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        console.error('📍 Error Details (JSON):', JSON.stringify(errorDetails, null, 2));
      } catch {
        console.error('📍 Error is not in JSON format');
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
          error: 'Chave da API do Gemini inválida ou modelo não disponível. Verifique a configuração em Sistema.',
          hint: errorDetails?.error?.message || errorText
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (response.status === 404) {
        return new Response(JSON.stringify({ 
          error: 'Modelo gemini-2.0-flash-exp não encontrado. Verifique se a API key tem permissões.',
          hint: 'Verifique se a API key tem permissões para geração de imagens'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao gerar imagem com Gemini.',
        details: errorDetails?.error?.message || errorText || response.statusText,
        status: response.status,
        model: 'gemini-2.0-flash-exp'
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log('✅ Gemini response received');

    // Extrair imagem da resposta
    const responseContent = data?.candidates?.[0]?.content?.parts || [];
    let imageBase64 = null;
    let mimeType = 'image/png';

    for (const part of responseContent) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
        break;
      }
    }
    
    console.log('📸 Image extraction result:', {
      hasImage: !!imageBase64,
      mimeType,
      dataLength: imageBase64 ? imageBase64.length : 0,
      partsCount: responseContent.length
    });

    if (!imageBase64) {
      console.error('❌ Failed to extract image from response');
      console.error('📍 Response structure:', JSON.stringify(data, null, 2).substring(0, 500));
      
      const errorMessage = data.error?.message;
      
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem foi gerada pela IA.',
          details: errorMessage || 'A resposta da API não contém dados de imagem'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Adicionar prefixo data:image com mimeType correto
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    
    console.log('✅ Image generated successfully with Gemini 2.0 Flash');

    return new Response(
      JSON.stringify({ 
        imageUrl,
        model_used: 'gemini-2.0-flash-exp'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-course-image-v2 function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao gerar imagem';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
