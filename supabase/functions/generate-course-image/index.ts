import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, areaName, description } = await req.json();
    console.log('Request received:', { courseName, areaName, hasDescription: !!description });

    if (!courseName) {
      console.error('Course name is required');
      return new Response(
        JSON.stringify({ error: 'Nome do curso é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar a chave API do Gemini das configurações do sistema
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do sistema incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('gemini_api_key')
      .single();

    if (settingsError) {
      console.error('Error fetching system settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações do sistema' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = settings?.gemini_api_key;
    
    if (!GEMINI_API_KEY) {
      console.error('Gemini API key not configured in system settings');
      return new Response(
        JSON.stringify({ error: 'Chave API do Gemini não configurada. Configure em Configurações do Sistema.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Gemini API key found in system settings');

    // Construir prompt otimizado para capa de curso
    const prompt = `Crie uma capa de curso educacional profissional e moderna para:

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ''}
${description ? `Descrição: ${description}` : ''}

Estilo: Design gráfico profissional para curso online, cores vibrantes mas elegantes, elementos visuais relacionados ao tema educacional, composição equilibrada e atraente. A imagem deve ser apropriada para uma capa de curso em uma plataforma de educação. Proporção 16:9.`;

    console.log('Generating image with Google Gemini for course:', courseName);
    console.log('Using prompt:', prompt);

    // Chamar API do Google AI (Gemini)
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseModalities: ["image"],
        temperature: 1.0,
        topK: 40,
        topP: 0.95
      }
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Requisição inválida para API do Gemini. Verifique a configuração.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Chave API do Gemini inválida. Verifique em Configurações do Sistema.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido na API do Gemini. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem com IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Google Gemini response received');
    console.log('Full response structure:', JSON.stringify(data, null, 2));

    // Tentar extrair a imagem de múltiplas formas possíveis
    let imageBase64 = null;
    let mimeType = 'image/png';

    // Formato 1: candidates[0].content.parts[0].inlineData
    if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      imageBase64 = data.candidates[0].content.parts[0].inlineData.data;
      mimeType = data.candidates[0].content.parts[0].inlineData.mimeType || 'image/png';
      console.log('Image found in format 1 (inlineData)');
    }
    // Formato 2: candidates[0].content.parts[0].image
    else if (data.candidates?.[0]?.content?.parts?.[0]?.image?.data) {
      imageBase64 = data.candidates[0].content.parts[0].image.data;
      mimeType = data.candidates[0].content.parts[0].image.mimeType || 'image/png';
      console.log('Image found in format 2 (image)');
    }
    // Formato 3: image direto
    else if (data.image?.data) {
      imageBase64 = data.image.data;
      mimeType = data.image.mimeType || 'image/png';
      console.log('Image found in format 3 (direct image)');
    }
    
    console.log('Image extraction result:', {
      hasImage: !!imageBase64,
      mimeType: mimeType,
      dataLength: imageBase64 ? imageBase64.length : 0
    });

    if (!imageBase64) {
      console.error('Failed to extract image from response');
      console.error('Response structure:', JSON.stringify(data, null, 2));
      
      // Verificar se há erro na resposta
      const errorMessage = data.error?.message || data.candidates?.[0]?.finishReason;
      
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem foi gerada pela IA.',
          details: errorMessage || 'A resposta da API não contém dados de imagem',
          geminiResponse: data
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Construir data URL com o base64
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    
    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-course-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao gerar imagem';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
