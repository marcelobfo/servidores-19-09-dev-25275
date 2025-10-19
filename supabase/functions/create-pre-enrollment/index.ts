import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 create-pre-enrollment - Iniciando processamento')

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ Authorization header ausente')
      return new Response(
        JSON.stringify({ error: 'Authorization header obrigatório' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with user's token to validate authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { 
          headers: { Authorization: authHeader }
        }
      }
    )

    // Validate user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('❌ Usuário não autenticado:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token inválido' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Usuário autenticado:', user.id)

    // Get enrollment data from request body
    const enrollmentData = await req.json()
    console.log('📝 Dados recebidos:', {
      user_id: enrollmentData.user_id,
      course_id: enrollmentData.course_id,
      full_name: enrollmentData.full_name
    })

    // Validate that user_id matches authenticated user
    if (enrollmentData.user_id !== user.id) {
      console.error('❌ user_id não corresponde ao usuário autenticado')
      return new Response(
        JSON.stringify({ error: 'user_id inválido' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase admin client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('💾 Inserindo pre_enrollment no banco de dados...')

    // Insert pre-enrollment using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('pre_enrollments')
      .insert([enrollmentData])
      .select()
      .single()

    if (error) {
      console.error('❌ Erro ao inserir pre_enrollment:', error)
      throw error
    }

    console.log('✅ Pre-enrollment criado com sucesso:', data.id)

    return new Response(
      JSON.stringify(data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao criar pré-matrícula',
        details: error.details || null,
        hint: error.hint || null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
