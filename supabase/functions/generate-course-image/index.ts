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

    // Usar a chave API do Lovable AI (Gemini gratuito até 13/10/2025)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured in environment');
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado. Entre em contato com o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('LOVABLE_API_KEY is configured');

    // Construir prompt otimizado para capa de curso
    const prompt = `Crie uma capa de curso educacional profissional e moderna para:

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ''}
${description ? `Descrição: ${description}` : ''}

Estilo: Design gráfico profissional para curso online, cores vibrantes mas elegantes, elementos visuais relacionados ao tema educacional, composição equilibrada e atraente. A imagem deve ser apropriada para uma capa de curso em uma plataforma de educação. Proporção 16:9.`;

    console.log('Generating image with Gemini for course:', courseName);
    console.log('Using prompt:', prompt);

    // Chamar Lovable AI Gateway (Gemini)
    const requestBody = {
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      modalities: ['image', 'text']
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes da Lovable AI. Entre em contato com o suporte.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem com IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Gemini response received');
    console.log('Response data structure:', JSON.stringify(data, null, 2));

    // Extrair a imagem base64 da resposta
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    console.log('Extracted imageUrl:', imageUrl ? 'Image data present' : 'No image data');

    if (!imageUrl) {
      console.error('No image in response. Full response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem foi gerada. Tente novamente.',
          details: 'Response structure did not contain image data'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-course-image function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno ao gerar imagem' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
