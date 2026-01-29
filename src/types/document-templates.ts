// Types for the document template management system

export type DocumentTemplateType = 'declaration' | 'study_plan' | 'quote' | 'certificate';

export type ContentBlockType = 
  | 'header'
  | 'title'
  | 'paragraph'
  | 'table'
  | 'signature'
  | 'footer'
  | 'image'
  | 'qrcode'
  | 'spacer'
  | 'modules_table'
  | 'cronograma_table'
  | 'quote_table'
  | 'frame'
  | 'course_content';

// Frame styles for certificates
export type FrameStyle = 'none' | 'simple' | 'double' | 'classic' | 'elegant' | 'modern';

export interface FramePreset {
  id: string;
  name: string;
  description: string;
  style: FrameStyle;
  color: string;
  width: number;
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'none', name: 'Sem Moldura', description: 'Certificado limpo sem bordas decorativas', style: 'none', color: '#000000', width: 0 },
  { id: 'simple', name: 'Moldura Simples', description: 'Uma borda simples e elegante', style: 'simple', color: '#1E40AF', width: 2 },
  { id: 'double', name: 'Moldura Dupla', description: 'Duas bordas paralelas', style: 'double', color: '#1E40AF', width: 3 },
  { id: 'classic', name: 'Moldura Clássica', description: 'Estilo tradicional com cantos decorados', style: 'classic', color: '#1E40AF', width: 4 },
  { id: 'elegant', name: 'Moldura Elegante', description: 'Design sofisticado com detalhes refinados', style: 'elegant', color: '#0F172A', width: 4 },
  { id: 'modern', name: 'Moldura Moderna', description: 'Design contemporâneo e minimalista', style: 'modern', color: '#3B82F6', width: 2 },
];

export type BlockAlignment = 'left' | 'center' | 'right';
export type HeaderLayout = 'logo-left' | 'logo-center' | 'logo-above' | 'logo-right';
export type ImageSource = 'system-logo' | 'director-signature' | 'custom-url';

export interface ContentBlockConfig {
  // Text settings
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  
  // Table settings
  columns?: Array<{ header: string; field: string; width: number }>;
  dataSource?: 'modules' | 'cronograma' | 'custom';
  
  // Table formatting
  tableBorderColor?: string;
  tableBorderWidth?: number;
  tableHeaderBgColor?: string;
  tableHeaderTextColor?: string;
  tableRowAlternateColor?: string;
  tableCellPadding?: number;
  
  // Image settings
  imageField?: 'logo' | 'signature' | 'custom';
  imageUrl?: string;
  imageSource?: ImageSource;
  width?: number;
  height?: number;
  
  // Spacing
  marginTop?: number;
  marginBottom?: number;
  
  // Line/separator
  lineWidth?: number;
  lineColor?: string;
  
  // Header settings
  showLogo?: boolean;
  showInstitutionInfo?: boolean;
  headerLayout?: HeaderLayout;
  logoAlign?: BlockAlignment;
  infoAlign?: BlockAlignment;
  
  // Signature settings
  signatureAlign?: BlockAlignment;
  
  // QR Code settings
  qrcodeAlign?: BlockAlignment;
  
  // Image block alignment
  blockAlign?: BlockAlignment;
  
  // Footer settings
  footerText?: string;
  footerAlign?: 'left' | 'center' | 'right';
  
  // Frame settings
  frameStyle?: FrameStyle;
  frameColor?: string;
  frameWidth?: number;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  order: number;
  config: ContentBlockConfig;
}

export interface DocumentTemplateMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DocumentTemplateStyles {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentTemplateType;
  is_default: boolean;
  is_active: boolean;
  page_orientation: 'portrait' | 'landscape';
  page_format: 'a4' | 'letter';
  margins: DocumentTemplateMargins;
  content_blocks: ContentBlock[];
  styles: DocumentTemplateStyles;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Available template variables for each document type
export const TEMPLATE_VARIABLES: Record<DocumentTemplateType, Array<{ key: string; label: string; description: string }>> = {
  declaration: [
    { key: '{{student_name}}', label: 'Nome do Aluno', description: 'Nome completo do aluno em maiúsculas' },
    { key: '{{student_cpf}}', label: 'CPF do Aluno', description: 'CPF formatado (xxx.xxx.xxx-xx)' },
    { key: '{{organization}}', label: 'Órgão/Instituição', description: 'Organização do aluno' },
    { key: '{{course_name}}', label: 'Nome do Curso', description: 'Nome completo do curso' },
    { key: '{{effective_hours}}', label: 'Carga Horária Efetiva', description: 'Carga horária ajustada' },
    { key: '{{start_date}}', label: 'Data de Início', description: 'Data de início do curso' },
    { key: '{{end_date}}', label: 'Data de Término', description: 'Data de término do curso' },
    { key: '{{current_date}}', label: 'Data Atual', description: 'Data atual por extenso' },
    { key: '{{institution_name}}', label: 'Nome da Instituição', description: 'Nome da instituição de ensino' },
    { key: '{{director_name}}', label: 'Nome do Diretor', description: 'Nome do diretor responsável' },
    { key: '{{director_title}}', label: 'Cargo do Diretor', description: 'Título/cargo do diretor' },
  ],
  study_plan: [
    { key: '{{student_name}}', label: 'Nome do Aluno', description: 'Nome completo do aluno' },
    { key: '{{organization}}', label: 'Órgão/Instituição', description: 'Organização do aluno' },
    { key: '{{course_name}}', label: 'Nome do Curso', description: 'Nome completo do curso' },
    { key: '{{effective_hours}}', label: 'Carga Horária Efetiva', description: 'Carga horária ajustada' },
    { key: '{{start_date}}', label: 'Data de Início', description: 'Data de início do curso' },
    { key: '{{end_date}}', label: 'Data de Término', description: 'Data de término do curso' },
    { key: '{{modules_table}}', label: 'Tabela de Módulos', description: 'Lista de módulos com carga horária' },
    { key: '{{cronograma_table}}', label: 'Cronograma', description: 'Tabela de cronograma de atividades' },
    { key: '{{course_content}}', label: 'Conteúdo Programático', description: 'Descrição completa do curso' },
    { key: '{{institution_name}}', label: 'Nome da Instituição', description: 'Nome da instituição' },
  ],
  quote: [
    { key: '{{student_name}}', label: 'Nome do Aluno', description: 'Nome do aluno' },
    { key: '{{course_name}}', label: 'Nome do Curso', description: 'Nome do curso' },
    { key: '{{course_hours}}', label: 'Carga Horária', description: 'Carga horária total' },
    { key: '{{enrollment_fee}}', label: 'Taxa de Matrícula', description: 'Valor da matrícula' },
    { key: '{{pre_enrollment_credit}}', label: 'Crédito Pré-Matrícula', description: 'Valor pago na pré-matrícula' },
    { key: '{{final_amount}}', label: 'Valor Final', description: 'Valor final a pagar' },
    { key: '{{pix_key}}', label: 'Chave PIX', description: 'Chave PIX para pagamento' },
    { key: '{{pix_holder_name}}', label: 'Titular PIX', description: 'Nome do titular da chave PIX' },
    { key: '{{current_date}}', label: 'Data Atual', description: 'Data atual' },
    { key: '{{institution_name}}', label: 'Nome da Instituição', description: 'Nome da instituição' },
  ],
  certificate: [
    { key: '{{student_name}}', label: 'Nome do Aluno', description: 'Nome completo do aluno' },
    { key: '{{student_cpf}}', label: 'CPF do Aluno', description: 'CPF formatado' },
    { key: '{{course_name}}', label: 'Nome do Curso', description: 'Nome do curso' },
    { key: '{{effective_hours}}', label: 'Carga Horária', description: 'Carga horária do curso' },
    { key: '{{completion_date}}', label: 'Data de Conclusão', description: 'Data de conclusão do curso' },
    { key: '{{certificate_code}}', label: 'Código do Certificado', description: 'Código único do certificado' },
    { key: '{{verification_url}}', label: 'URL de Verificação', description: 'Link para verificar o certificado' },
    { key: '{{qr_code}}', label: 'QR Code', description: 'QR Code de verificação' },
    { key: '{{institution_name}}', label: 'Nome da Instituição', description: 'Nome da instituição' },
    { key: '{{director_name}}', label: 'Nome do Diretor', description: 'Nome do diretor' },
  ],
};

// Default content blocks for each document type - UPDATED based on real documents
export const DEFAULT_CONTENT_BLOCKS: Record<DocumentTemplateType, ContentBlock[]> = {
  declaration: [
    { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true, headerLayout: 'logo-left' as HeaderLayout } },
    { id: '2', type: 'title', order: 2, config: { text: 'DECLARAÇÃO DE MATRÍCULA', fontSize: 16, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 20 } },
    { id: '3', type: 'paragraph', order: 3, config: { 
      text: 'Declaramos que <strong>{{student_name}}</strong>, CPF: {{student_cpf}}, {{organization}}, está matriculado(a) no curso de <strong>{{course_name}}</strong>.',
      fontSize: 11,
      align: 'justify' as const,
      marginTop: 20
    }},
    { id: '4', type: 'paragraph', order: 4, config: { 
      text: 'O curso será iniciado em <strong>{{start_date}}</strong> com término previsto para <strong>{{end_date}}</strong> e será realizado de forma não presencial (online), com carga horária de <strong>{{effective_hours}} horas</strong>, sob a supervisão de um tutor qualificado.',
      fontSize: 11,
      align: 'justify' as const,
      marginTop: 10
    }},
    { id: '5', type: 'paragraph', order: 5, config: { text: '{{current_date}}', fontSize: 11, align: 'left' as const, marginTop: 25 } },
    { id: '6', type: 'signature', order: 6, config: { imageField: 'signature' as const, marginTop: 30, signatureAlign: 'left' as BlockAlignment } },
    { id: '7', type: 'footer', order: 7, config: { footerAlign: 'center' as const, footerText: 'E-commerce por {{institution_name}} © {{year}}. {{pix_holder_name}}/CNPJ: {{institution_cnpj}}. Whatsapp: {{institution_phone}} ou e-mail: {{institution_email}}' } },
  ],
  study_plan: [
    { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true, headerLayout: 'logo-left' as HeaderLayout } },
    { id: '2', type: 'title', order: 2, config: { text: 'PLANO DE ESTUDOS', fontSize: 16, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 10 } },
    { id: '3', type: 'paragraph', order: 3, config: { text: '<strong>Curso:</strong> {{course_name}}', fontSize: 10, marginTop: 15 } },
    { id: '4', type: 'paragraph', order: 4, config: { text: '<strong>Instituição:</strong> {{organization}}', fontSize: 10, marginTop: 5 } },
    { id: '5', type: 'paragraph', order: 5, config: { text: '<strong>Servidor:</strong> {{student_name}}', fontSize: 10, marginTop: 5 } },
    { id: '6', type: 'paragraph', order: 6, config: { text: '<strong>Carga Horária:</strong> {{effective_hours}} horas', fontSize: 10, marginTop: 5 } },
    { id: '7', type: 'paragraph', order: 7, config: { text: '<strong>Período:</strong> {{start_date}} a {{end_date}}', fontSize: 10, marginTop: 5 } },
    { id: '8', type: 'modules_table', order: 8, config: { marginTop: 15 } },
    { id: '9', type: 'title', order: 9, config: { text: 'Cronograma', fontSize: 12, fontWeight: 'bold' as const, align: 'left' as const, marginTop: 15 } },
    { id: '10', type: 'cronograma_table', order: 10, config: { marginTop: 8 } },
    { id: '11', type: 'title', order: 11, config: { text: 'CONTEÚDO PROGRAMÁTICO DO CURSO', fontSize: 12, fontWeight: 'bold' as const, align: 'left' as const, marginTop: 15 } },
    { id: '12', type: 'course_content', order: 12, config: { marginTop: 8, fontSize: 10 } },
    { id: '13', type: 'footer', order: 13, config: { footerAlign: 'center' as const } },
  ],
  quote: [
    { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true, headerLayout: 'logo-left' as HeaderLayout } },
    { id: '2', type: 'title', order: 2, config: { text: 'ORÇAMENTO', fontSize: 16, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 15 } },
    { id: '3', type: 'paragraph', order: 3, config: { text: '<strong>Curso:</strong> {{course_name}}', fontSize: 10, marginTop: 15 } },
    { id: '4', type: 'paragraph', order: 4, config: { text: '<strong>Instituição:</strong> {{organization}}', fontSize: 10, marginTop: 5 } },
    { id: '5', type: 'paragraph', order: 5, config: { text: '<strong>Servidor:</strong> {{student_name}}', fontSize: 10, marginTop: 5 } },
    { id: '6', type: 'paragraph', order: 6, config: { text: '<strong>Carga Horária:</strong> {{course_hours}} horas', fontSize: 10, marginTop: 5 } },
    { id: '7', type: 'paragraph', order: 7, config: { text: '<strong>Período:</strong> {{start_date}} a {{end_date}}', fontSize: 10, marginTop: 5 } },
    { id: '8', type: 'quote_table', order: 8, config: { marginTop: 15 }},
    { id: '9', type: 'title', order: 9, config: { text: 'O pagamento pode ser realizado da seguinte forma:', fontSize: 11, fontWeight: 'bold' as const, align: 'left' as const, marginTop: 15 } },
    { id: '10', type: 'paragraph', order: 10, config: { text: 'Pagamento a vista (transferência bancária ou PIX) – R$ {{final_amount}}', fontSize: 10, marginTop: 8 } },
    { id: '11', type: 'paragraph', order: 11, config: { text: 'Pagamento no Boleto, podendo ser dividido em até 12 parcelas no cartão de crédito', fontSize: 10, marginTop: 5 } },
    { id: '12', type: 'title', order: 12, config: { text: 'O que está incluso?', fontSize: 11, fontWeight: 'bold' as const, align: 'left' as const, marginTop: 15 } },
    { id: '13', type: 'paragraph', order: 13, config: { 
      text: '1. Carta de aceite no curso para apresentação ao órgão de lotação.\n2. Plano de estudos.\n3. Vídeo aulas.\n4. Livros em PDF para acompanhamento das disciplinas.\n5. Certificado.\n6. Toda a documentação facilitadora de aceite no órgão de origem.\n7. Suporte',
      fontSize: 10,
      marginTop: 8
    }},
    { id: '14', type: 'signature', order: 14, config: { imageField: 'signature' as const, marginTop: 25, signatureAlign: 'left' as BlockAlignment } },
    { id: '15', type: 'footer', order: 15, config: { footerAlign: 'center' as const } },
  ],
  certificate: [
    { id: '1', type: 'frame', order: 1, config: { frameStyle: 'classic' as FrameStyle, frameColor: '#1E40AF', frameWidth: 4 } },
    { id: '2', type: 'header', order: 2, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true, headerLayout: 'logo-above' as HeaderLayout, logoAlign: 'center' as BlockAlignment } },
    { id: '3', type: 'title', order: 3, config: { text: 'CERTIFICADO', fontSize: 24, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 20 } },
    { id: '4', type: 'paragraph', order: 4, config: { 
      text: 'Certificamos que <strong>{{student_name}}</strong> concluiu o Curso de <strong>{{course_name}}</strong> promovido pela {{institution_name}}, no período de {{start_date}} a {{completion_date}} com carga horária total de <strong>{{effective_hours}} horas</strong>.',
      fontSize: 12,
      align: 'center' as const,
      marginTop: 25
    }},
    { id: '5', type: 'paragraph', order: 5, config: { text: '{{current_date}}', fontSize: 11, align: 'center' as const, marginTop: 25 } },
    { id: '6', type: 'signature', order: 6, config: { imageField: 'signature' as const, marginTop: 20, signatureAlign: 'center' as BlockAlignment } },
    { id: '7', type: 'qrcode', order: 7, config: { marginTop: 15, width: 50, height: 50, qrcodeAlign: 'center' as BlockAlignment } },
    { id: '8', type: 'paragraph', order: 8, config: { text: 'Código do Certificado: {{certificate_code}} · Verifique autenticidade em: {{verification_url}}', fontSize: 8, align: 'center' as const, marginTop: 5 } },
    { id: '9', type: 'footer', order: 9, config: { footerAlign: 'center' as const } },
  ],
};

// Certificate presets for quick template creation
export interface CertificatePreset {
  id: string;
  name: string;
  description: string;
  content_blocks: ContentBlock[];
}

export const CERTIFICATE_PRESETS: CertificatePreset[] = [
  {
    id: 'classic',
    name: 'Certificado Clássico',
    description: 'Layout tradicional com bordas e design formal',
    content_blocks: [
      { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true } },
      { id: '2', type: 'spacer', order: 2, config: { marginTop: 20 } },
      { id: '3', type: 'title', order: 3, config: { text: 'CERTIFICADO', fontSize: 24, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 10 } },
      { id: '4', type: 'paragraph', order: 4, config: { text: 'A {{institution_name}} certifica que', fontSize: 11, align: 'center' as const, marginTop: 25 } },
      { id: '5', type: 'title', order: 5, config: { text: '{{student_name}}', fontSize: 18, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 10 } },
      { id: '6', type: 'paragraph', order: 6, config: { text: 'CPF: {{student_cpf}}', fontSize: 10, align: 'center' as const, marginTop: 5 } },
      { id: '7', type: 'paragraph', order: 7, config: { 
        text: 'concluiu com êxito o curso de {{course_name}}, com carga horária de {{effective_hours}} horas, na modalidade online.',
        fontSize: 12,
        align: 'center' as const,
        marginTop: 20
      }},
      { id: '8', type: 'paragraph', order: 8, config: { text: '{{current_date}}', fontSize: 11, align: 'center' as const, marginTop: 30 } },
      { id: '9', type: 'signature', order: 9, config: { imageField: 'signature' as const, marginTop: 25 } },
      { id: '10', type: 'spacer', order: 10, config: { marginTop: 15 } },
      { id: '11', type: 'qrcode', order: 11, config: { marginTop: 10, width: 50, height: 50 } },
      { id: '12', type: 'paragraph', order: 12, config: { text: 'Código: {{certificate_code}}', fontSize: 8, align: 'center' as const, marginTop: 5 } },
      { id: '13', type: 'footer', order: 13, config: { footerAlign: 'center' as const } },
    ],
  },
  {
    id: 'modern',
    name: 'Certificado Moderno',
    description: 'Design clean e contemporâneo com foco no conteúdo',
    content_blocks: [
      { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: false } },
      { id: '2', type: 'title', order: 2, config: { text: 'CERTIFICADO DE CONCLUSÃO', fontSize: 20, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 30 } },
      { id: '3', type: 'spacer', order: 3, config: { marginTop: 25 } },
      { id: '4', type: 'paragraph', order: 4, config: { 
        text: 'Certificamos que {{student_name}} concluiu com sucesso o curso:',
        fontSize: 11,
        align: 'center' as const,
        marginTop: 10
      }},
      { id: '5', type: 'title', order: 5, config: { text: '{{course_name}}', fontSize: 16, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 15 } },
      { id: '6', type: 'paragraph', order: 6, config: { text: 'Carga Horária: {{effective_hours}} horas | CPF: {{student_cpf}}', fontSize: 10, align: 'center' as const, marginTop: 15 } },
      { id: '7', type: 'paragraph', order: 7, config: { text: 'Data de Conclusão: {{completion_date}}', fontSize: 10, align: 'center' as const, marginTop: 10 } },
      { id: '8', type: 'signature', order: 8, config: { imageField: 'signature' as const, marginTop: 40 } },
      { id: '9', type: 'qrcode', order: 9, config: { marginTop: 20, width: 45, height: 45 } },
      { id: '10', type: 'paragraph', order: 10, config: { text: '{{certificate_code}}', fontSize: 8, align: 'center' as const, marginTop: 3 } },
      { id: '11', type: 'footer', order: 11, config: { footerAlign: 'center' as const } },
    ],
  },
  {
    id: 'minimal',
    name: 'Certificado Minimalista',
    description: 'Layout simples e elegante com menos elementos visuais',
    content_blocks: [
      { id: '1', type: 'header', order: 1, config: { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: false } },
      { id: '2', type: 'spacer', order: 2, config: { marginTop: 40 } },
      { id: '3', type: 'title', order: 3, config: { text: 'Certificado', fontSize: 22, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 10 } },
      { id: '4', type: 'spacer', order: 4, config: { marginTop: 30 } },
      { id: '5', type: 'paragraph', order: 5, config: { 
        text: '{{student_name}} completou o curso {{course_name}} com {{effective_hours}} horas de carga horária.',
        fontSize: 12,
        align: 'center' as const,
        marginTop: 10
      }},
      { id: '6', type: 'paragraph', order: 6, config: { text: '{{completion_date}}', fontSize: 11, align: 'center' as const, marginTop: 40 } },
      { id: '7', type: 'signature', order: 7, config: { imageField: 'signature' as const, marginTop: 30 } },
      { id: '8', type: 'paragraph', order: 8, config: { text: '{{certificate_code}}', fontSize: 9, align: 'center' as const, marginTop: 30 } },
    ],
  },
];

// Mock data for preview
export const MOCK_PREVIEW_DATA = {
  student_name: 'MARIA SILVA SANTOS',
  student_cpf: '123.456.789-00',
  organization: 'Prefeitura Municipal de São Paulo',
  course_name: 'Gestão Pública Municipal',
  course_hours: 390,
  effective_hours: 195,
  start_date: '01/02/2025',
  end_date: '01/08/2025',
  current_date: 'São Paulo, 14 de janeiro de 2025.',
  enrollment_fee: '679,00',
  pre_enrollment_credit: '67,00',
  final_amount: '612,00',
  pix_key: '12.345.678/0001-90',
  pix_holder_name: 'JMR Empreendimentos Digitais',
  certificate_code: 'CERT-2025-ABC123',
  completion_date: '01/08/2025',
  verification_url: 'https://exemplo.com/verify/CERT-2025-ABC123',
  institution_name: 'Instituto Educacional',
  director_name: 'Dr. João da Silva',
  director_title: 'Diretor Acadêmico',
  course_content: 'O curso de Gestão Pública Municipal aborda os fundamentos da administração pública, incluindo planejamento estratégico, gestão de recursos humanos, finanças públicas, licitações e contratos administrativos. Os participantes aprenderão sobre as melhores práticas de governança, transparência e prestação de contas, além de desenvolver habilidades para implementar políticas públicas eficazes. O conteúdo também inclui estudos de caso e exercícios práticos para aplicação dos conhecimentos adquiridos.',
  modules: [
    { name: 'Introdução à Gestão Pública', hours: 40 },
    { name: 'Finanças Públicas', hours: 60 },
    { name: 'Licitações e Contratos', hours: 50 },
    { name: 'Gestão de Pessoas', hours: 45 },
  ],
};
