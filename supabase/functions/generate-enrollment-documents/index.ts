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

${institutionName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${institutionCNPJ}, com sede em ${institutionAddress}, DECLARA para os devidos fins que:

${preEnrollment.full_name}, CPF nº ${preEnrollment.cpf || 'não informado'}, encontra-se MATRICULADO(A) no curso de ${preEnrollment.courses.name}.

DADOS DO CURSO:
- Curso: ${preEnrollment.courses.name}
- Carga Horária: ${preEnrollment.courses.duration_hours || 390} horas
- Modalidade: Ensino a Distância
- Data de Início: ${preEnrollment.license_start_date ? new Date(preEnrollment.license_start_date).toLocaleDateString('pt-BR') : 'A definir'}
- Data de Término: ${preEnrollment.license_end_date ? new Date(preEnrollment.license_end_date).toLocaleDateString('pt-BR') : 'A definir'}

DADOS DO ALUNO:
- Nome: ${preEnrollment.full_name}
- CPF: ${preEnrollment.cpf || 'não informado'}
- E-mail: ${preEnrollment.email}
- Telefone: ${preEnrollment.phone || 'não informado'}

Esta declaração é emitida para comprovação de matrícula e poderá ser utilizada para os fins que se fizerem necessários.

Data: ${new Date().toLocaleDateString('pt-BR')}

${institutionName}
${settings?.director_name || 'Diretor Acadêmico'}
    `.trim();

    // Generate study plan content with formatted modules
    let modulesText = '';
    if (preEnrollment.courses.modules) {
      try {
        const modules = JSON.parse(preEnrollment.courses.modules);
        if (Array.isArray(modules)) {
          modulesText = modules.map((module, index) => {
            const title = typeof module === 'string' ? module : module.title || `Módulo ${index + 1}`;
            const description = typeof module === 'object' && module.description ? 
              module.description.replace(/<[^>]*>/g, '').trim() : '';
            
            let moduleText = `${index + 1}. ${title}`;
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

${institutionName}

CURSO: ${preEnrollment.courses.name}
ALUNO: ${preEnrollment.full_name}
CARGA HORÁRIA: ${preEnrollment.courses.duration_hours || 390} horas
DURAÇÃO: ${preEnrollment.courses.duration_days || 'A definir'} dias

DESCRIÇÃO DO CURSO:
${preEnrollment.courses.description || 'Descrição não disponível'}

CONTEÚDO PROGRAMÁTICO:

${modulesText || 'Módulos não especificados'}

METODOLOGIA:
O curso será ministrado na modalidade de Ensino a Distância (EaD), através da plataforma online da instituição, com aulas gravadas, materiais didáticos digitais e avaliações online.

AVALIAÇÃO:
A avaliação será realizada através de atividades práticas e teóricas distribuídas ao longo do curso, com aprovação mediante nota mínima de 70%.

CERTIFICAÇÃO:
Ao final do curso, o aluno receberá certificado de conclusão, desde que tenha cumprido todos os requisitos estabelecidos.

Data: ${new Date().toLocaleDateString('pt-BR')}

${institutionName}
${settings?.director_name || 'Diretor Acadêmico'}
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
        error: error.message || 'Erro interno do servidor' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});