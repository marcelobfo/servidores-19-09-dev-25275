import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Usar Lovable AI Gateway (chave já configurada automaticamente)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    console.log('LOVABLE_API_KEY exists:', !!LOVABLE_API_KEY);
    
    if (!LOVABLE_API_KEY) {
      console.error('Lovable API key not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do sistema incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Using Lovable AI for image generation');

    // Construir prompt otimizado para capa de curso
    const prompt = `Crie uma capa de curso educacional profissional e moderna para:

Título: ${courseName}
${areaName ? `Área: ${areaName}` : ''}
${description ? `Descrição: ${description}` : ''}

Estilo: Design gráfico profissional para curso online, cores vibrantes mas elegantes, elementos visuais relacionados ao tema educacional, composição equilibrada e atraente. A imagem deve ser apropriada para uma capa de curso em uma plataforma de educação. Proporção 16:9.`;

    console.log('Generating image for course:', courseName);
    console.log('Using prompt:', prompt);

    // Chamar Lovable AI Gateway para geração de imagem
    const requestBody = {
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      modalities: ["image", "text"]
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('Calling Lovable AI Gateway...');

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      console.error('Full error response:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao gerar imagem com IA. Tente novamente.',
          details: errorText,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Lovable AI response received');
    console.log('Full response structure:', JSON.stringify(data, null, 2));

    // Extrair imagem do formato Lovable AI
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
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
    
    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl: imageBase64 }),
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
