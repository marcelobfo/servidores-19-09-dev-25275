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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { preEnrollmentId } = await req.json();

    if (!preEnrollmentId) {
      throw new Error('ID da pré-matrícula é obrigatório');
    }

    console.log('Generating documents for pre-enrollment:', preEnrollmentId);

    // Get pre-enrollment data with course details
    const { data: preEnrollment, error: enrollmentError } = await supabaseClient
      .from('pre_enrollments')
      .select(`
        *,
        courses (
          name,
          description,
          modules,
          duration_hours,
          duration_days
        )
      `)
      .eq('id', preEnrollmentId)
      .single();

    if (enrollmentError || !preEnrollment) {
      throw new Error('Pré-matrícula não encontrada');
    }

    // Get system settings
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('*')
      .single();

    const institutionName = settings?.institution_name || 'Infomar Cursos Livres';
    const institutionAddress = settings?.institution_address || 'Av. Paulista, 1636 CJ 4 – São Paulo - SP';
    const institutionCNPJ = settings?.institution_cnpj || '41.651.963/0001-32';

    // Generate enrollment declaration content
    const declarationContent = `
DECLARAÇÃO DE MATRÍCULA

Declaramos para os devidos fins que ${preEnrollment.full_name.toUpperCase()}, portador(a) do CPF nº ${preEnrollment.cpf || 'não informado'}, ${preEnrollment.organization || ''}, encontra-se regularmente matriculado(a) no curso de "${preEnrollment.courses.name.toUpperCase()}".

O referido curso possui carga horária de ${preEnrollment.courses.duration_hours || 390} (${numberToWords(preEnrollment.courses.duration_hours || 390)}) horas, sendo realizado na modalidade de Ensino a Distância (EAD), com datas a serem definidas.

O curso está devidamente registrado em nossa instituição e atende aos requisitos necessários para fins de capacitação profissional e licença para capacitação.

Declaramos ainda que o estudante terá acompanhamento pedagógico especializado durante todo o período do curso, com acesso a materiais didáticos atualizados e suporte técnico-pedagógico.

Esta declaração é válida para todos os fins de direito.

São Paulo, ${new Date().toLocaleDateString('pt-BR')}.

${settings?.director_name || 'Diretor Acadêmico'}
${settings?.director_title || 'Diretor Acadêmico Infomar Cursos Livres'}
    `.trim();

    // Generate study plan content with formatted modules
    let modulesText = '';
    if (preEnrollment.courses.modules) {
      try {
        const parsedModules = JSON.parse(preEnrollment.courses.modules);
        let modulesList: any[] = [];
        
        // Handle new format with módulos key
        if (parsedModules.módulos && Array.isArray(parsedModules.módulos)) {
          modulesList = parsedModules.módulos;
        } else if (Array.isArray(parsedModules)) {
          modulesList = parsedModules;
        }
        
        if (modulesList.length > 0) {
          modulesText = modulesList.map((module, index) => {
            const title = typeof module === 'string' 
              ? module 
              : (module.nome || module.title || `Módulo ${index + 1}`);
            const hours = typeof module === 'object' && module.carga_horaria 
              ? ` - ${module.carga_horaria}h` 
              : '';
            const description = typeof module === 'object' && module.description ? 
              module.description.replace(/<[^>]*>/g, '').trim() : '';
            
            let moduleText = `${index + 1}. ${title}${hours}`;
            if (description) {
              moduleText += `\n   ${description}`;
            }
            return moduleText;
          }).join('\n\n');
        }
      } catch (e) {
        console.warn('Could not parse modules JSON:', e);
        modulesText = preEnrollment.courses.modules;
      }
    }

    const studyPlanContent = `
PLANO DE ESTUDOS

DADOS DO CURSO
Curso: ${preEnrollment.courses.name.toUpperCase()}
Carga Horária Total: ${preEnrollment.courses.duration_hours || 390} horas
Modalidade: Ensino à Distância (EAD)

DADOS DO ESTUDANTE
Nome: ${preEnrollment.full_name}
CPF: ${preEnrollment.cpf || 'não informado'}
${preEnrollment.organization ? `Instituição: ${preEnrollment.organization}` : ''}

CONTEÚDO PROGRAMÁTICO
${modulesText || 'Conteúdo a ser definido'}

CARGA HORÁRIA TOTAL: ${preEnrollment.courses.duration_hours || 390}h

METODOLOGIA
O curso será desenvolvido na modalidade de Ensino a Distância (EAD), com aulas online, materiais didáticos digitais e acompanhamento tutorial. As atividades incluem videoaulas, exercícios práticos, fóruns de discussão e avaliações online.

CRONOGRAMA DE ESTUDOS
Carga horária semanal recomendada: 20 horas
Horário de atendimento: Segunda a Sexta, 8h às 18h
Plataforma: Sistema EAD Infomar Cursos

São Paulo, ${new Date().toLocaleDateString('pt-BR')}.

${settings?.director_name || 'Diretor Acadêmico'}
${settings?.director_title || 'Diretor Acadêmico Infomar Cursos Livres'}
    `.trim();

    // Check if documents already exist
    const { data: existingDeclaration } = await supabaseClient
      .from('enrollment_declarations')
      .select('id')
      .eq('pre_enrollment_id', preEnrollmentId)
      .single();

    const { data: existingStudyPlan } = await supabaseClient
      .from('study_plans')
      .select('id')
      .eq('pre_enrollment_id', preEnrollmentId)
      .single();

    // Insert enrollment declaration if it doesn't exist
    if (!existingDeclaration) {
      const { error: declarationError } = await supabaseClient
        .from('enrollment_declarations')
        .insert({
          pre_enrollment_id: preEnrollmentId,
          content: declarationContent
        });

      if (declarationError) {
        throw new Error('Erro ao gerar declaração de matrícula');
      }
    }

    // Insert study plan if it doesn't exist
    if (!existingStudyPlan) {
      const { error: studyPlanError } = await supabaseClient
        .from('study_plans')
        .insert({
          pre_enrollment_id: preEnrollmentId,
          content: studyPlanContent
        });

      if (studyPlanError) {
        throw new Error('Erro ao gerar plano de estudos');
      }
    }

    console.log('Documents generated successfully for pre-enrollment:', preEnrollmentId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Documentos gerados com sucesso',
        declarationExists: !!existingDeclaration,
        studyPlanExists: !!existingStudyPlan
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating documents:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to convert numbers to words (simplified Portuguese version)
const numberToWords = (num: number): string => {
  const ones = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  if (num === 0) return 'zero';
  if (num === 100) return 'cem';

  let result = '';

  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    if (num % 100 !== 0) result += ' e ';
  }

  const remainder = num % 100;
  if (remainder >= 10 && remainder < 20) {
    result += teens[remainder - 10];
  } else {
    if (remainder >= 20) {
      result += tens[Math.floor(remainder / 10)];
      if (remainder % 10 !== 0) result += ' e ';
    }
    if (remainder % 10 !== 0 || remainder < 10) {
      result += ones[remainder % 10];
    }
  }

  return result.trim();
};