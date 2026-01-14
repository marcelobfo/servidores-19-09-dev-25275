import jsPDF from 'jspdf';
import { DocumentTemplate, ContentBlock } from '@/types/document-templates';

interface SystemSettings {
  institution_name: string;
  institution_address: string;
  institution_cep: string;
  institution_cnpj: string;
  institution_phone: string;
  institution_email: string;
  institution_website: string;
  director_name: string;
  director_title: string;
  logo_url?: string;
  director_signature_url?: string;
  pix_key?: string;
  pix_holder_name?: string;
}

interface PreviewData {
  student_name: string;
  student_cpf: string;
  organization: string;
  course_name: string;
  course_hours: number;
  effective_hours: number;
  start_date: string;
  end_date: string;
  current_date: string;
  enrollment_fee: string;
  pre_enrollment_credit: string;
  final_amount: string;
  pix_key: string;
  pix_holder_name: string;
  certificate_code?: string;
  completion_date?: string;
  verification_url?: string;
  institution_name: string;
  director_name: string;
  director_title?: string;
  modules: Array<{ name: string; hours: number }>;
}

// Helper function to load image from URL with timeout
const loadImage = (url: string, timeout: number = 5000): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeoutId = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, timeout);
    
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
};

// Replace variables in text
const replaceVariables = (text: string, data: PreviewData, settings: SystemSettings): string => {
  return text
    .replace(/\{\{student_name\}\}/g, data.student_name || '')
    .replace(/\{\{student_cpf\}\}/g, data.student_cpf || '')
    .replace(/\{\{organization\}\}/g, data.organization || '')
    .replace(/\{\{course_name\}\}/g, data.course_name || '')
    .replace(/\{\{course_hours\}\}/g, String(data.course_hours || ''))
    .replace(/\{\{effective_hours\}\}/g, String(data.effective_hours || ''))
    .replace(/\{\{start_date\}\}/g, data.start_date || '')
    .replace(/\{\{end_date\}\}/g, data.end_date || '')
    .replace(/\{\{current_date\}\}/g, data.current_date || '')
    .replace(/\{\{enrollment_fee\}\}/g, data.enrollment_fee || '')
    .replace(/\{\{pre_enrollment_credit\}\}/g, data.pre_enrollment_credit || '')
    .replace(/\{\{final_amount\}\}/g, data.final_amount || '')
    .replace(/\{\{pix_key\}\}/g, data.pix_key || settings.pix_key || settings.institution_cnpj || '')
    .replace(/\{\{pix_holder_name\}\}/g, data.pix_holder_name || settings.pix_holder_name || '')
    .replace(/\{\{certificate_code\}\}/g, data.certificate_code || '')
    .replace(/\{\{completion_date\}\}/g, data.completion_date || '')
    .replace(/\{\{verification_url\}\}/g, data.verification_url || '')
    .replace(/\{\{institution_name\}\}/g, settings.institution_name || '')
    .replace(/\{\{director_name\}\}/g, settings.director_name || '')
    .replace(/\{\{director_title\}\}/g, settings.director_title || '');
};

// Render a single block
const renderBlock = async (
  pdf: jsPDF,
  block: ContentBlock,
  data: PreviewData,
  settings: SystemSettings,
  yPosition: number,
  margins: { left: number; right: number }
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margins.left - margins.right;
  
  // Apply margin top
  yPosition += block.config.marginTop || 0;

  switch (block.type) {
    case 'header':
      yPosition = await renderHeader(pdf, settings, yPosition, margins.left);
      break;

    case 'title':
    case 'paragraph':
      yPosition = renderText(pdf, block, data, settings, yPosition, margins, contentWidth);
      break;

    case 'signature':
      yPosition = await renderSignature(pdf, settings, yPosition, margins.left);
      break;

    case 'footer':
      renderFooter(pdf, settings);
      break;

    case 'modules_table':
      yPosition = renderModulesTable(pdf, data, yPosition, margins.left, contentWidth);
      break;

    case 'cronograma_table':
      yPosition = renderCronogramaTable(pdf, data, settings, yPosition, margins.left);
      break;

    case 'spacer':
      yPosition += block.config.marginTop || 20;
      break;

    case 'qrcode':
      // QR Code rendering would require a library like qrcode
      // For now, just add a placeholder
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(pageWidth / 2 - 30, yPosition, 60, 60);
      pdf.setFontSize(8);
      pdf.text('QR Code', pageWidth / 2, yPosition + 35, { align: 'center' });
      yPosition += 65;
      break;
  }

  // Apply margin bottom
  yPosition += block.config.marginBottom || 0;

  return yPosition;
};

// Render header
const renderHeader = async (
  pdf: jsPDF,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number
): Promise<number> => {
  let logoLoaded = false;

  if (settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = logo.width;
        canvas.height = logo.height;
        ctx.drawImage(logo, 0, 0);
        const logoData = canvas.toDataURL('image/png');
        pdf.addImage(logoData, 'PNG', marginLeft, yPosition, 25, 18);
        logoLoaded = true;
      }
    } catch (error) {
      console.warn('Logo could not be loaded:', error);
    }
  }

  const textStartX = logoLoaded ? marginLeft + 30 : marginLeft;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(settings.institution_name, textStartX, yPosition + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Cursos Online e Presenciais', textStartX, yPosition + 11);
  pdf.text(settings.institution_address, textStartX, yPosition + 15);
  pdf.text(`CEP: ${settings.institution_cep}`, textStartX, yPosition + 19);

  return yPosition + 30;
};

// Render text (title or paragraph)
const renderText = (
  pdf: jsPDF,
  block: ContentBlock,
  data: PreviewData,
  settings: SystemSettings,
  yPosition: number,
  margins: { left: number; right: number },
  contentWidth: number
): number => {
  const text = replaceVariables(block.config.text || '', data, settings);
  const fontSize = block.config.fontSize || 11;
  const fontWeight = block.config.fontWeight || 'normal';
  const align = block.config.align || 'left';

  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', fontWeight);

  const pageWidth = pdf.internal.pageSize.getWidth();
  let x = margins.left;

  if (align === 'center') {
    x = pageWidth / 2;
  } else if (align === 'right') {
    x = pageWidth - margins.right;
  }

  const splitText = pdf.splitTextToSize(text, contentWidth);
  
  if (align === 'justify') {
    // Simple justify - just use left alignment for now
    pdf.text(splitText, margins.left, yPosition);
  } else {
    pdf.text(splitText, x, yPosition, { align: align as any });
  }

  return yPosition + (splitText.length * fontSize * 0.5);
};

// Render signature
const renderSignature = async (
  pdf: jsPDF,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number
): Promise<number> => {
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = signature.width;
      canvas.height = signature.height;
      ctx?.drawImage(signature, 0, 0);
      const signatureData = canvas.toDataURL('image/png');
      pdf.addImage(signatureData, 'PNG', marginLeft, yPosition - 5, 40, 15);
      yPosition += 12;
    } catch (error) {
      console.warn('Signature could not be loaded:', error);
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(marginLeft, yPosition + 5, marginLeft + 70, yPosition + 5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, marginLeft, yPosition + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${settings.director_title} ${settings.institution_name}`, marginLeft, yPosition + 15);

  return yPosition + 20;
};

// Render footer
const renderFooter = (pdf: jsPDF, settings: SystemSettings): void => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);

  const year = new Date().getFullYear();
  const footerLine1 = `E-commerce por ${settings.institution_name} © ${year}. ${settings.pix_holder_name || 'JMR Empreendimentos digitais'}/CNPJ: ${settings.institution_cnpj}. Whatsapp: ${settings.institution_phone} ou e-mail: ${settings.institution_email}`;

  pdf.text(footerLine1, 105, footerY, { align: 'center' });
  if (settings.institution_website) {
    pdf.text(settings.institution_website, 105, footerY + 4, { align: 'center' });
  }

  pdf.setTextColor(0, 0, 0);
};

// Render modules table
const renderModulesTable = (
  pdf: jsPDF,
  data: PreviewData,
  yPosition: number,
  marginLeft: number,
  contentWidth: number
): number => {
  const modules = data.modules || [];
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);

  // Table header
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.rect(marginLeft, yPosition - 4, contentWidth - 40, 8);
  pdf.rect(marginLeft + contentWidth - 40, yPosition - 4, 40, 8);
  pdf.text('Módulos', marginLeft + 5, yPosition + 1);
  pdf.text('Carga Horária (horas)', marginLeft + contentWidth - 38, yPosition + 1);

  yPosition += 6;
  pdf.setFont('helvetica', 'normal');

  let totalHours = 0;
  modules.forEach((module) => {
    pdf.rect(marginLeft, yPosition - 4, contentWidth - 40, 8);
    pdf.rect(marginLeft + contentWidth - 40, yPosition - 4, 40, 8);

    const moduleName = module.name.length > 55 ? module.name.substring(0, 52) + '...' : module.name;
    pdf.text(moduleName, marginLeft + 5, yPosition + 1);
    pdf.text(`${module.hours}`, marginLeft + contentWidth - 20, yPosition + 1, { align: 'center' });

    totalHours += module.hours;
    yPosition += 6;
  });

  // Total row
  pdf.setFont('helvetica', 'bold');
  pdf.rect(marginLeft, yPosition - 4, contentWidth - 40, 8);
  pdf.rect(marginLeft + contentWidth - 40, yPosition - 4, 40, 8);
  pdf.text('TOTAL', marginLeft + 5, yPosition + 1);
  pdf.text(`${data.effective_hours || totalHours}`, marginLeft + contentWidth - 20, yPosition + 1, { align: 'center' });

  return yPosition + 10;
};

// Render cronograma table
const renderCronogramaTable = (
  pdf: jsPDF,
  data: PreviewData,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number
): number => {
  const modules = data.modules || [];
  
  pdf.setFontSize(8);
  
  const colWidths = [35, 25, 25, 65, 40];
  const headers = ['Data', 'Horário', 'CH Semanal', 'Atividade/Conteúdo', 'Local'];
  let xPos = marginLeft;

  pdf.setFont('helvetica', 'bold');
  headers.forEach((header, i) => {
    pdf.rect(xPos, yPosition - 4, colWidths[i], 8);
    pdf.text(header, xPos + 2, yPosition + 1);
    xPos += colWidths[i];
  });

  yPosition += 6;
  pdf.setFont('helvetica', 'normal');

  // Generate cronograma rows
  const startDate = new Date(data.start_date.split('/').reverse().join('-') || Date.now());
  const totalDays = 180; // Default 6 months
  const daysPerModule = Math.floor(totalDays / Math.max(modules.length, 1));

  modules.forEach((module, index) => {
    const moduleStartDate = new Date(startDate);
    moduleStartDate.setDate(startDate.getDate() + (index * daysPerModule));
    const moduleEndDate = new Date(moduleStartDate);
    moduleEndDate.setDate(moduleStartDate.getDate() + daysPerModule - 1);

    const dateRange = `${moduleStartDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} a ${moduleEndDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
    const weeklyHours = Math.round(module.hours / Math.ceil(daysPerModule / 7)) || 30;

    xPos = marginLeft;
    const rowData = [
      dateRange,
      '8:00 às 12:00',
      weeklyHours.toString(),
      module.name.substring(0, 35),
      `Plataforma ${settings.institution_name.split(' ')[0]}`
    ];

    rowData.forEach((text, i) => {
      pdf.rect(xPos, yPosition - 4, colWidths[i], 8);
      pdf.text(text, xPos + 2, yPosition + 1);
      xPos += colWidths[i];
    });

    yPosition += 6;
  });

  return yPosition;
};

// Main function to generate PDF from template
export const generatePdfFromTemplate = async (
  template: DocumentTemplate,
  data: PreviewData,
  settings: SystemSettings
): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: template.page_orientation,
    format: template.page_format,
  });

  const margins = template.margins;
  let yPosition = margins.top;
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Sort blocks by order
  const sortedBlocks = [...template.content_blocks].sort((a, b) => a.order - b.order);

  for (const block of sortedBlocks) {
    // Check for page break (except for footer which is always at the bottom)
    if (block.type !== 'footer' && yPosition > pageHeight - margins.bottom - 40) {
      // Add footer before page break
      const footerBlock = sortedBlocks.find(b => b.type === 'footer');
      if (footerBlock) {
        renderFooter(pdf, settings);
      }
      
      pdf.addPage();
      yPosition = margins.top;
    }

    yPosition = await renderBlock(
      pdf,
      block,
      data,
      settings,
      yPosition,
      { left: margins.left, right: margins.right }
    );
  }

  return pdf.output('blob');
};

// Export function to get active template
export const getActiveTemplate = async (type: string): Promise<DocumentTemplate | null> => {
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error || !data) {
    // Try to get any active template
    const { data: anyTemplate } = await supabase
      .from('document_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!anyTemplate) return null;
    
    return {
      ...anyTemplate,
      content_blocks: typeof anyTemplate.content_blocks === 'string' 
        ? JSON.parse(anyTemplate.content_blocks) 
        : anyTemplate.content_blocks,
      margins: typeof anyTemplate.margins === 'string' 
        ? JSON.parse(anyTemplate.margins) 
        : anyTemplate.margins,
      styles: typeof anyTemplate.styles === 'string' 
        ? JSON.parse(anyTemplate.styles) 
        : anyTemplate.styles,
    } as DocumentTemplate;
  }

  return {
    ...data,
    content_blocks: typeof data.content_blocks === 'string' 
      ? JSON.parse(data.content_blocks) 
      : data.content_blocks,
    margins: typeof data.margins === 'string' 
      ? JSON.parse(data.margins) 
      : data.margins,
    styles: typeof data.styles === 'string' 
      ? JSON.parse(data.styles) 
      : data.styles,
  } as DocumentTemplate;
};
