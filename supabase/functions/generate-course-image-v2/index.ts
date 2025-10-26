import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Construir prompt otimizado para capa de curso
    const prompt = `Crie uma capa de curso educacional profissional e moderna para:

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ''}
${description ? `Descrição: ${description}` : ''}

Estilo: Design gráfico profissional para curso online, cores vibrantes mas elegantes, elementos visuais relacionados ao tema educacional, composição equilibrada e atraente. A imagem deve ser apropriada para uma capa de curso em uma plataforma de educação. Proporção 16:9.`;

    console.log('Generating image for course:', courseName);
    console.log('Using prompt:', prompt);

    // Chamar API direta do Google Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('Calling Google Gemini API...');

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
      console.error('Full error response:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Chave da API do Gemini inválida. Verifique a configuração em Sistema.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao gerar imagem com o Gemini.',
          details: errorText,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Google Gemini response received');
    console.log('Full response structure:', JSON.stringify(data, null, 2));

    // Extrair imagem do formato do Google Gemini
    const imageBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    console.log('Image extraction result:', {
      hasImage: !!imageBase64,
      dataLength: imageBase64 ? imageBase64.length : 0
    });

    if (!imageBase64) {
      console.error('Failed to extract image from response');
      console.error('Response structure:', JSON.stringify(data, null, 2));
      
      const errorMessage = data.error?.message;
      
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem foi gerada pela IA.',
          details: errorMessage || 'A resposta da API não contém dados de imagem'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Adicionar prefixo data:image/png;base64,
    const imageUrl = `data:image/png;base64,${imageBase64}`;
    
    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
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
