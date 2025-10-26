import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, type = "course", courseName, areaName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Payment required. Please add credits to your Lovable AI workspace.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

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

ljasbdibapsbdva´sdnvina´sdv[]
