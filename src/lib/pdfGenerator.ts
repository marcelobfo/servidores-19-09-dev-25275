import jsPDF from 'jspdf';
import { getActiveTemplate, generatePdfFromTemplate } from './dynamicPdfGenerator';

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

interface Course {
  name: string;
  duration_hours: number;
  effective_hours?: number;
  weekly_hours?: number;
  start_date?: string;
  end_date?: string;
  modules?: string;
  description?: string;
  pre_enrollment_fee?: number;
  enrollment_fee?: number;
}

interface PreEnrollment {
  full_name: string;
  cpf?: string;
  organization?: string;
  phone?: string;
  email?: string;
  license_start_date?: string;
  license_end_date?: string;
  course: Course;
}

// Helper to format date for preview data
const formatDateForPreview = (dateStr?: string): string => {
  if (!dateStr) return 'a definir';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

// Helper to prepare preview data from enrollment
const preparePreviewData = (enrollment: PreEnrollment, settings: SystemSettings, extraData?: any) => {
  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours || 390;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const today = new Date();
  const formattedCurrentDate = `${today.getDate().toString().padStart(2, '0')} de ${months[today.getMonth()]} de ${today.getFullYear()}`;
  
  // Parse modules
  let modules: Array<{ name: string; hours: number }> = [];
  if (enrollment.course.modules) {
    try {
      const parsedModules = JSON.parse(enrollment.course.modules);
      if (Array.isArray(parsedModules)) {
        modules = parsedModules.map((m: any) => ({
          name: m.name || m.nome || m.title || 'Módulo',
          hours: m.hours || m.carga_horaria || 0
        }));
        
        // Distribute hours proportionally if not defined
        const totalHours = modules.reduce((sum, m) => sum + m.hours, 0);
        if (totalHours === 0 && modules.length > 0) {
          const hoursPerModule = Math.floor(effectiveHours / modules.length);
          modules = modules.map((m, i) => ({
            ...m,
            hours: i === modules.length - 1 
              ? effectiveHours - (hoursPerModule * (modules.length - 1))
              : hoursPerModule
          }));
        }
      }
    } catch (e) {
      console.error('Error parsing modules:', e);
    }
  }

  return {
    student_name: enrollment.full_name.toUpperCase(),
    student_cpf: formatCPF(enrollment.cpf || ''),
    organization: enrollment.organization || '',
    course_name: enrollment.course.name,
    course_hours: enrollment.course.duration_hours,
    effective_hours: effectiveHours,
    weekly_hours: enrollment.course.weekly_hours || 30, // NEW: Include weekly hours
    start_date: formatDateForPreview(enrollment.license_start_date || enrollment.course.start_date),
    end_date: formatDateForPreview(enrollment.license_end_date || enrollment.course.end_date),
    current_date: formattedCurrentDate,
    enrollment_fee: formatCurrency(enrollment.course.enrollment_fee || 0),
    pre_enrollment_credit: extraData?.preEnrollmentCredit || '0,00',
    final_amount: extraData?.finalAmount || formatCurrency(enrollment.course.enrollment_fee || 0),
    pix_key: settings.pix_key || settings.institution_cnpj,
    pix_holder_name: settings.pix_holder_name || '',
    institution_name: settings.institution_name,
    director_name: settings.director_name,
    director_title: settings.director_title,
    course_content: enrollment.course.description || '',
    modules
  };
};

// Helper function to load image from URL with timeout
const loadImage = (url: string, timeout: number = 10000): Promise<HTMLImageElement> => {
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
    img.onerror = (e) => {
      clearTimeout(timeoutId);
      reject(e);
    };
    img.src = url;
  });
};

// Helper function to format CPF
const formatCPF = (cpf: string): string => {
  if (!cpf) return 'não informado';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  }
  return cpf;
};

// Helper function to format date
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'a definir';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

// Helper function to format currency
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to add document footer
const addDocumentFooter = (pdf: jsPDF, settings: SystemSettings): void => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  
  const year = new Date().getFullYear();
  const footerLine1 = `E-commerce por ${settings.institution_name} © ${year}. ${settings.pix_holder_name || 'JMR Empreendimentos digitais'}/CNPJ: ${settings.institution_cnpj}. Whatsapp: ${settings.institution_phone} ou e-mail: ${settings.institution_email}`;
  const footerLine2 = settings.institution_website || '';
  
  pdf.text(footerLine1, 105, footerY, { align: 'center' });
  if (footerLine2) {
    pdf.text(footerLine2, 105, footerY + 4, { align: 'center' });
  }
  
  pdf.setTextColor(0, 0, 0);
};

// Helper to add header with logo
const addHeader = async (pdf: jsPDF, settings: SystemSettings, startY: number = 15): Promise<number> => {
  let yPosition = startY;
  let logoLoaded = false;
  
  // Add logo if available - with robust error handling
  if (settings.logo_url) {
    try {
      // Try to load the logo with a timeout
      const logo = await loadImage(settings.logo_url, 8000);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = logo.width;
        canvas.height = logo.height;
        ctx.drawImage(logo, 0, 0);
        const logoData = canvas.toDataURL('image/png');
        pdf.addImage(logoData, 'PNG', 15, yPosition, 25, 18);
        logoLoaded = true;
      }
    } catch (error) {
      console.warn('Logo could not be loaded, continuing without logo:', error);
      // Continue without logo - don't block document generation
    }
  }

  // Header information - position based on whether logo was loaded
  const textStartX = logoLoaded ? 45 : 20;
  
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

// Helper function to convert numbers to words (simplified version)
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

// ============================================
// DECLARAÇÃO DE MATRÍCULA
// ============================================
export const generateEnrollmentDeclaration = async (
  enrollment: PreEnrollment,
  settings: SystemSettings
): Promise<Blob> => {
  // Try to use saved default template first
  try {
    const template = await getActiveTemplate('declaration');
    if (template) {
      console.log('📄 Using saved default template for declaration');
      const previewData = preparePreviewData(enrollment, settings);
      return await generatePdfFromTemplate(template, previewData, settings);
    }
  } catch (error) {
    console.warn('Could not load default template, falling back to hardcoded:', error);
  }
  
  // Fallback to hardcoded generation
  console.log('📄 Using fallback hardcoded template for declaration');
  const pdf = new jsPDF();
  
  let yPosition = await addHeader(pdf, settings);
  
  // Title - centered and bold
  yPosition += 15;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARAÇÃO DE MATRÍCULA', 105, yPosition, { align: 'center' });

  yPosition += 20;

  // Declaration content - simplified text matching the template
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours || 390;
  const startDate = formatDate(enrollment.license_start_date || enrollment.course.start_date);
  const endDate = formatDate(enrollment.license_end_date || enrollment.course.end_date);
  const orgText = enrollment.organization ? `, ${enrollment.organization}` : '';
  
  const declarationText = `Declaramos que ${enrollment.full_name.toUpperCase()}, CPF: ${formatCPF(enrollment.cpf || '')}${orgText}, está matriculada no curso de ${enrollment.course.name}. O curso será iniciado em ${startDate} com término previsto para ${endDate} e será realizado de forma não presencial, on-line com carga Horária de ${effectiveHours} horas e estará sob a supervisão de um tutor qualificado.`;

  const splitText = pdf.splitTextToSize(declarationText, 170);
  pdf.text(splitText, 20, yPosition);

  yPosition += splitText.length * 6 + 20;

  // Date and location
  const addressParts = settings.institution_address.split('-');
  const city = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'São Paulo';
  
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const today = new Date();
  const formattedDate = `${city}, ${today.getDate().toString().padStart(2, '0')} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
  
  pdf.text(formattedDate, 20, yPosition);

  yPosition += 25;

  // Signature area
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = signature.width;
      canvas.height = signature.height;
      ctx?.drawImage(signature, 0, 0);
      const signatureData = canvas.toDataURL('image/png');
      pdf.addImage(signatureData, 'PNG', 20, yPosition - 5, 40, 15);
      yPosition += 12;
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition + 5, 90, yPosition + 5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, 20, yPosition + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${settings.director_title} ${settings.institution_name}`, 20, yPosition + 15);

  // Footer
  addDocumentFooter(pdf, settings);

  return pdf.output('blob');
};

// ============================================
// PLANO DE ESTUDOS
// ============================================
export const generateStudyPlan = async (
  enrollment: PreEnrollment,
  settings: SystemSettings
): Promise<Blob> => {
  // Try to use saved default template first
  try {
    const template = await getActiveTemplate('study_plan');
    if (template) {
      console.log('📄 Using saved default template for study_plan');
      const previewData = preparePreviewData(enrollment, settings);
      return await generatePdfFromTemplate(template, previewData, settings);
    }
  } catch (error) {
    console.warn('Could not load default template, falling back to hardcoded:', error);
  }
  
  // Fallback to hardcoded generation
  console.log('📄 Using fallback hardcoded template for study_plan');
  const pdf = new jsPDF();
  
  let yPosition = await addHeader(pdf, settings);

  // Title
  yPosition += 10;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PLANO DE ESTUDOS', 105, yPosition, { align: 'center' });

  yPosition += 15;

  // Course Info Block
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Curso: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.course.name, 36, yPosition);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Instituição: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.organization || 'Não informada', 44, yPosition);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Servidor: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.full_name.toUpperCase(), 40, yPosition);
  
  yPosition += 6;
  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Carga Horária: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${effectiveHours} horas`, 51, yPosition);
  
  yPosition += 6;
  const startDate = formatDate(enrollment.license_start_date || enrollment.course.start_date);
  const endDate = formatDate(enrollment.license_end_date || enrollment.course.end_date);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Período: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${startDate} a ${endDate}`, 40, yPosition);

  yPosition += 12;

  // Parse modules
  let modules: Array<{ name: string; hours: number; description?: string }> = [];
  if (enrollment.course.modules) {
    try {
      const parsedModules = JSON.parse(enrollment.course.modules);
      
      if (Array.isArray(parsedModules)) {
        modules = parsedModules.map((m: any) => {
          if (typeof m === 'string') {
            return { name: m, hours: 0 };
          }
          return {
            name: m.name || m.nome || m.title || 'Módulo',
            hours: m.hours || m.carga_horaria || 0,
            description: m.description || m.descricao || ''
          };
        });
      }
    } catch (e) {
      console.error('Error parsing modules:', e);
    }
  }

  // Calculate module hours proportionally
  const effectiveHoursTotal = enrollment.course.effective_hours || enrollment.course.duration_hours;
  if (modules.length > 0) {
    const totalHours = modules.reduce((sum, m) => sum + m.hours, 0);
    if (totalHours === 0) {
      const hoursPerModule = Math.floor(effectiveHoursTotal / modules.length);
      modules = modules.map((m, i) => ({
        ...m,
        hours: i === modules.length - 1 
          ? effectiveHoursTotal - (hoursPerModule * (modules.length - 1))
          : hoursPerModule
      }));
    } else if (enrollment.course.effective_hours && enrollment.course.effective_hours !== enrollment.course.duration_hours) {
      const ratio = effectiveHoursTotal / enrollment.course.duration_hours;
      modules = modules.map((m, i) => ({
        ...m,
        hours: i === modules.length - 1 
          ? effectiveHoursTotal - modules.slice(0, -1).reduce((sum, mod) => sum + Math.round(mod.hours * ratio), 0)
          : Math.round(m.hours * ratio)
      }));
    }
  }

  // Module table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  
  // Table header with borders
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.rect(20, yPosition - 4, 130, 8);
  pdf.rect(150, yPosition - 4, 40, 8);
  pdf.text('Módulos', 25, yPosition + 1);
  pdf.text('Carga Horária (horas)', 152, yPosition + 1);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  
  modules.forEach((module) => {
    if (yPosition > 250) {
      addDocumentFooter(pdf, settings);
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.rect(20, yPosition - 4, 130, 8);
    pdf.rect(150, yPosition - 4, 40, 8);
    
    const moduleName = module.name.length > 55 ? module.name.substring(0, 52) + '...' : module.name;
    pdf.text(moduleName, 25, yPosition + 1);
    pdf.text(`${module.hours}`, 168, yPosition + 1, { align: 'center' });
    
    yPosition += 6;
  });
  
  // Total row
  pdf.setFont('helvetica', 'bold');
  pdf.rect(20, yPosition - 4, 130, 8);
  pdf.rect(150, yPosition - 4, 40, 8);
  pdf.text('TOTAL', 25, yPosition + 1);
  pdf.text(`${effectiveHoursTotal}`, 168, yPosition + 1, { align: 'center' });
  
  yPosition += 15;

  // Cronograma section
  if (yPosition > 200) {
    addDocumentFooter(pdf, settings);
    pdf.addPage();
    yPosition = 20;
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Cronograma', 20, yPosition);
  
  yPosition += 8;
  pdf.setFontSize(8);
  
  // Cronograma table header
  const colWidths = [35, 25, 25, 65, 40];
  const headers = ['Data', 'Horário', 'CH Semanal', 'Atividade/Conteúdo', 'Local'];
  let xPos = 20;
  
  pdf.setFont('helvetica', 'bold');
  headers.forEach((header, i) => {
    pdf.rect(xPos, yPosition - 4, colWidths[i], 8);
    pdf.text(header, xPos + 2, yPosition + 1);
    xPos += colWidths[i];
  });
  
  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  
  // Generate cronograma rows based on modules and dates
  if ((enrollment.license_start_date || enrollment.course.start_date) && (enrollment.license_end_date || enrollment.course.end_date) && modules.length > 0) {
    const startDateObj = new Date(enrollment.license_start_date || enrollment.course.start_date!);
    const endDateObj = new Date(enrollment.license_end_date || enrollment.course.end_date!);
    const totalDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const daysPerModule = Math.floor(totalDays / modules.length);
    
    modules.forEach((module, index) => {
      if (yPosition > 250) {
        addDocumentFooter(pdf, settings);
        pdf.addPage();
        yPosition = 20;
      }
      
      const moduleStartDate = new Date(startDateObj);
      moduleStartDate.setDate(startDateObj.getDate() + (index * daysPerModule));
      const moduleEndDate = new Date(moduleStartDate);
      moduleEndDate.setDate(moduleStartDate.getDate() + daysPerModule - 1);
      
      if (index === modules.length - 1) {
        moduleEndDate.setTime(endDateObj.getTime());
      }
      
      const dateRange = `${moduleStartDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} a ${moduleEndDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
      const weeklyHours = Math.round(module.hours / Math.ceil(daysPerModule / 7)) || 30;
      
      xPos = 20;
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
  }

  yPosition += 10;

  // Conteúdo Programático
  if (yPosition > 200) {
    addDocumentFooter(pdf, settings);
    pdf.addPage();
    yPosition = 20;
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONTEÚDO PROGRAMÁTICO DO CURSO', 20, yPosition);
  
  yPosition += 10;
  pdf.setFontSize(9);
  
  // Check if modules have descriptions
  const hasModuleDescriptions = modules.some(m => m.description && m.description.trim());
  
  if (hasModuleDescriptions) {
    // Show each module with its description
    modules.forEach((module, index) => {
      if (yPosition > 250) {
        addDocumentFooter(pdf, settings);
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Módulo ${index + 1} – ${module.name}`, 20, yPosition);
      yPosition += 6;
      
      if (module.description) {
        pdf.setFont('helvetica', 'normal');
        const descLines = module.description.split('\n').filter(line => line.trim());
        descLines.forEach((line, lineIndex) => {
          if (yPosition > 270) {
            addDocumentFooter(pdf, settings);
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(`${lineIndex + 1}. ${line.trim().replace(/^\d+\.\s*/, '')}`, 25, yPosition);
          yPosition += 5;
        });
      }
      
      yPosition += 5;
    });
  } else if (enrollment.course.description) {
    // Use the general course description if modules don't have descriptions
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    const descriptionLines = pdf.splitTextToSize(enrollment.course.description, 170);
    descriptionLines.forEach((line: string) => {
      if (yPosition > 270) {
        addDocumentFooter(pdf, settings);
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 5;
    });
    yPosition += 5;
  } else {
    // Fallback: just list module names
    modules.forEach((module, index) => {
      if (yPosition > 250) {
        addDocumentFooter(pdf, settings);
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Módulo ${index + 1} – ${module.name}`, 20, yPosition);
      yPosition += 8;
    });
  }

  // Footer on last page
  addDocumentFooter(pdf, settings);

  return pdf.output('blob');
};

// ============================================
// ORÇAMENTO (QUOTE)
// ============================================
export const generateQuote = async (
  enrollment: PreEnrollment,
  settings: SystemSettings,
  preEnrollmentPaid: boolean = false,
  preEnrollmentAmount: number = 0
): Promise<Blob> => {
  // Try to use saved default template first
  try {
    const template = await getActiveTemplate('quote');
    if (template) {
      console.log('📄 Using saved default template for quote');
      const totalFee = enrollment.course.enrollment_fee || 0;
      const paidAmount = preEnrollmentPaid ? preEnrollmentAmount : 0;
      const remainingAmount = Math.max(totalFee - paidAmount, 0);
      
      const previewData = preparePreviewData(enrollment, settings, {
        preEnrollmentCredit: formatCurrency(paidAmount),
        finalAmount: formatCurrency(remainingAmount)
      });
      return await generatePdfFromTemplate(template, previewData, settings);
    }
  } catch (error) {
    console.warn('Could not load default template, falling back to hardcoded:', error);
  }
  
  // Fallback to hardcoded generation
  console.log('📄 Using fallback hardcoded template for quote');
  const pdf = new jsPDF();
  
  let yPosition = await addHeader(pdf, settings);

  // Title
  yPosition += 10;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ORÇAMENTO', 105, yPosition, { align: 'center' });

  yPosition += 15;

  // Course Info Block
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Curso: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.course.name, 36, yPosition);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Instituição: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.organization || 'Não informada', 44, yPosition);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Servidor: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(enrollment.full_name.toUpperCase(), 40, yPosition);
  
  yPosition += 6;
  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Carga Horária: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${effectiveHours} horas`, 51, yPosition);
  
  yPosition += 6;
  const startDate = formatDate(enrollment.license_start_date || enrollment.course.start_date);
  const endDate = formatDate(enrollment.license_end_date || enrollment.course.end_date);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Período: ', 20, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${startDate} a ${endDate}`, 40, yPosition);

  yPosition += 15;

  // Value table
  const totalFee = enrollment.course.enrollment_fee || 0;
  const paidAmount = preEnrollmentPaid ? preEnrollmentAmount : 0;
  const remainingAmount = Math.max(totalFee - paidAmount, 0);

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  
  // Table header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.rect(20, yPosition - 4, 120, 8);
  pdf.rect(140, yPosition - 4, 50, 8);
  pdf.text('Descrição', 25, yPosition + 1);
  pdf.text('Valor (Reais)', 145, yPosition + 1);
  
  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  
  // Row 1: Total course value
  pdf.rect(20, yPosition - 4, 120, 8);
  pdf.rect(140, yPosition - 4, 50, 8);
  pdf.text(`Licença capacitação – ${effectiveHours} horas`, 25, yPosition + 1);
  pdf.text(formatCurrency(totalFee), 145, yPosition + 1);
  
  yPosition += 6;
  
  // Row 2: Discount (only show if there was a payment)
  if (paidAmount > 0) {
    pdf.rect(20, yPosition - 4, 120, 8);
    pdf.rect(140, yPosition - 4, 50, 8);
    pdf.text('Crédito de pré-matrícula (abatido)', 25, yPosition + 1);
    pdf.text(`-${formatCurrency(paidAmount)}`, 145, yPosition + 1);
    
    yPosition += 6;
  }
  
  // Row 3: Remaining value
  pdf.setFont('helvetica', 'bold');
  pdf.rect(20, yPosition - 4, 120, 8);
  pdf.rect(140, yPosition - 4, 50, 8);
  pdf.text('Valor a pagar', 25, yPosition + 1);
  pdf.text(formatCurrency(remainingAmount), 145, yPosition + 1);
  
  yPosition += 15;

  // Info text
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  const infoText1 = 'Nossa equipe elabora a declaração de matrícula e plano de ensino e enviará imediatamente.';
  pdf.text(infoText1, 20, yPosition);
  
  yPosition += 8;
  
  const pixKey = settings.pix_key || settings.institution_cnpj;
  const pixHolder = settings.pix_holder_name || 'Ricardo Jaco de Oliveira e Cia LTDA';
  const infoText2 = `O valor restante deverá ser realizado pelo PIX (CNPJ: ${pixKey} – ${pixHolder}).`;
  const splitText2 = pdf.splitTextToSize(infoText2, 170);
  pdf.text(splitText2, 20, yPosition);
  
  yPosition += splitText2.length * 5 + 5;
  
  const infoText3 = `O valor restante de R$ ${formatCurrency(remainingAmount)} reais deverá ser pago quando a licença for aprovada e poderá ser dividido em até 12 parcelas no cartão de crédito (Juros da operadora).`;
  const splitText3 = pdf.splitTextToSize(infoText3, 170);
  pdf.text(splitText3, 20, yPosition);
  
  yPosition += splitText3.length * 5 + 12;

  // O que está incluso?
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('O que está incluso?', 20, yPosition);
  
  yPosition += 8;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const inclusions = [
    'Carta de aceite no curso para apresentação ao órgão de lotação.',
    'Plano de estudos.',
    'Vídeo aulas.',
    'Livros em PDF para acompanhamento das disciplinas.',
    'Certificado.',
    'Toda a documentação facilitadora de aceite no órgão de origem.',
    'Suporte.'
  ];
  
  inclusions.forEach((item, index) => {
    pdf.text(`${index + 1}. ${item}`, 20, yPosition);
    yPosition += 6;
  });

  yPosition += 10;

  // Signature area
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = signature.width;
      canvas.height = signature.height;
      ctx?.drawImage(signature, 0, 0);
      const signatureData = canvas.toDataURL('image/png');
      pdf.addImage(signatureData, 'PNG', 20, yPosition - 5, 40, 15);
      yPosition += 12;
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition + 5, 90, yPosition + 5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, 20, yPosition + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${settings.director_title} ${settings.institution_name}`, 20, yPosition + 15);

  // Footer
  addDocumentFooter(pdf, settings);

  return pdf.output('blob');
};

// ============================================
// GENERIC DOCUMENT
// ============================================
export const generateDocument = async (
  content: string,
  filename: string
): Promise<void> => {
  const pdf = new jsPDF();
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  
  const lines = pdf.splitTextToSize(content, 170);
  let yPosition = 20;
  
  lines.forEach((line: string) => {
    if (yPosition > 280) {
      pdf.addPage();
      yPosition = 20;
    }
    pdf.text(line, 20, yPosition);
    yPosition += 6;
  });
  
  pdf.save(filename);
};
