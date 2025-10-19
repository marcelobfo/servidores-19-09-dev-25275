import jsPDF from 'jspdf';

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
}

interface Course {
  name: string;
  duration_hours: number;
  start_date: string;
  end_date: string;
  modules?: string;
  description?: string;
}

interface PreEnrollment {
  full_name: string;
  cpf?: string;
  organization?: string;
  phone?: string;
  email?: string;
  course: Course;
}

// Helper function to load image from URL
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const generateStudyPlan = async (
  enrollment: PreEnrollment,
  settings: SystemSettings
): Promise<Blob> => {
  const pdf = new jsPDF();
  
  let yPosition = 20;

  // Add logo if available
  if (settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = logo.width;
      canvas.height = logo.height;
      ctx?.drawImage(logo, 0, 0);
      const logoData = canvas.toDataURL('image/jpeg');
      pdf.addImage(logoData, 'JPEG', 15, yPosition, 30, 20);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Header information
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(settings.institution_name, 50, yPosition + 5);
  pdf.text(settings.institution_address, 50, yPosition + 10);
  pdf.text(`CEP: ${settings.institution_cep} - CNPJ: ${settings.institution_cnpj}`, 50, yPosition + 15);
  pdf.text(`Tel: ${settings.institution_phone} - Email: ${settings.institution_email}`, 50, yPosition + 20);

  yPosition += 40;

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PLANO DE ESTUDOS', 105, yPosition, { align: 'center' });

  yPosition += 20;

  // Course Info Box
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DADOS DO CURSO', 20, yPosition);
  
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Curso: ${enrollment.course.name}`, 20, yPosition);
  yPosition += 6;
  pdf.text(`Carga Horária Total: ${enrollment.course.duration_hours} horas`, 20, yPosition);
  yPosition += 6;
  if (enrollment.course.start_date && enrollment.course.end_date) {
    pdf.text(`Período: ${new Date(enrollment.course.start_date).toLocaleDateString('pt-BR')} a ${new Date(enrollment.course.end_date).toLocaleDateString('pt-BR')}`, 20, yPosition);
  }
  yPosition += 6;
  pdf.text(`Modalidade: Ensino à Distância (EAD)`, 20, yPosition);

  yPosition += 15;

  // Student Info Box
  pdf.setFont('helvetica', 'bold');
  pdf.text('DADOS DO ESTUDANTE', 20, yPosition);
  
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Nome: ${enrollment.full_name}`, 20, yPosition);
  if (enrollment.cpf) {
    yPosition += 6;
    pdf.text(`CPF: ${enrollment.cpf}`, 20, yPosition);
  }
  if (enrollment.organization) {
    yPosition += 6;
    pdf.text(`Instituição: ${enrollment.organization}`, 20, yPosition);
  }

  yPosition += 15;

  // Course Content
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONTEÚDO PROGRAMÁTICO', 20, yPosition);

  yPosition += 10;

  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(20, yPosition - 5, 170, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('MÓDULO', 25, yPosition);
  pdf.text('CARGA HORÁRIA', 150, yPosition);

  yPosition += 8;

  // Parse modules with better handling
  let modules: Array<{ nome: string; carga_horaria: number }> = [];
  if (enrollment.course.modules) {
    try {
      const parsedModules = JSON.parse(enrollment.course.modules);
      
      // Normalize to always use correct format
      if (Array.isArray(parsedModules)) {
        modules = parsedModules.map((m: any) => {
          if (typeof m === 'string') {
            return { nome: m, carga_horaria: 0 };
          }
          // Prioritize 'name' and 'hours' (ModuleEditor format)
          return {
            nome: m.name || m.nome || m.title || 'Módulo',
            carga_horaria: m.hours || m.carga_horaria || 0
          };
        });
      }
    } catch (e) {
      console.error('Error parsing modules:', e);
    }
  }

  // Default modules if none provided or calculate hours if missing
  if (modules.length === 0) {
    const hoursPerModule = Math.floor(enrollment.course.duration_hours / 4);
    modules = [
      { nome: 'Módulo Introdutório', carga_horaria: hoursPerModule },
      { nome: 'Módulo Básico', carga_horaria: hoursPerModule },
      { nome: 'Módulo Intermediário', carga_horaria: hoursPerModule },
      { nome: 'Módulo Avançado', carga_horaria: enrollment.course.duration_hours - (hoursPerModule * 3) }
    ];
  } else {
    // Calculate missing hours proportionally
    const totalHours = modules.reduce((sum, m) => sum + m.carga_horaria, 0);
    if (totalHours === 0) {
      const hoursPerModule = Math.floor(enrollment.course.duration_hours / modules.length);
      modules = modules.map((m, i) => ({
        ...m,
        carga_horaria: i === modules.length - 1 
          ? enrollment.course.duration_hours - (hoursPerModule * (modules.length - 1))
          : hoursPerModule
      }));
    }
  }

  // Helper function to check page break needs - improved
  const addPageBreakIfNeeded = (currentY: number, requiredSpace: number = 40): number => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginBottom = 40; // Increased margin for signature area
    
    // More conservative space calculation
    if (currentY + requiredSpace > pageHeight - marginBottom) {
      pdf.addPage();
      return 30; // Start from top of new page with proper margin
    }
    return currentY;
  };

  // Module table with actual module names
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  modules.forEach((module, index) => {
    yPosition = addPageBreakIfNeeded(yPosition, 10);
    
    // Use actual module name, not generic "Módulo X"
    const moduleName = module.nome || `Módulo ${index + 1}`;
    pdf.text(`${index + 1}. ${moduleName}`, 25, yPosition);
    pdf.text(`${module.carga_horaria}h`, 155, yPosition);
    yPosition += 6;
  });

  // Total
  yPosition += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.line(20, yPosition, 190, yPosition);
  yPosition += 5;
  const total = modules.reduce((sum, module) => sum + module.carga_horaria, 0);
  pdf.text('CARGA HORÁRIA TOTAL:', 25, yPosition);
  pdf.text(`${total}h`, 150, yPosition);

  yPosition += 15;

  // Methodology
  pdf.setFont('helvetica', 'bold');
  pdf.text('METODOLOGIA', 20, yPosition);
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const methodologyText = 'O curso será desenvolvido na modalidade de Ensino a Distância (EAD), com aulas online, materiais didáticos digitais e acompanhamento tutorial. As atividades incluem videoaulas, exercícios práticos, fóruns de discussão e avaliações online.';
  const splitMethodology = pdf.splitTextToSize(methodologyText, 170);
  pdf.text(splitMethodology, 20, yPosition);
  yPosition += splitMethodology.length * 4 + 10;

  // Schedule
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('CRONOGRAMA DE ESTUDOS', 20, yPosition);
  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text('Carga horária semanal recomendada: 20 horas', 20, yPosition);
  yPosition += 5;
  pdf.text('Horário de atendimento: Segunda a Sexta, 8h às 18h', 20, yPosition);
  yPosition += 5;
  pdf.text('Plataforma: Sistema EAD Infomar Cursos', 20, yPosition);

  // Signature area - ensure enough space for signature section
  yPosition = addPageBreakIfNeeded(yPosition, 80);
  
  yPosition += 25;
  
  pdf.text(`São Paulo, ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);
  
  yPosition += 25;

  // Add director signature if available
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = signature.width;
      canvas.height = signature.height;
      ctx?.drawImage(signature, 0, 0);
      const signatureData = canvas.toDataURL('image/png');
      pdf.addImage(signatureData, 'PNG', 20, yPosition - 15, 40, 15);
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  }
  
  pdf.line(20, yPosition + 5, 80, yPosition + 5);
  pdf.text(settings.director_name, 20, yPosition + 12);
  pdf.text(settings.director_title, 20, yPosition + 18);

  return pdf.output('blob');
};

export const generateDocument = async (
  content: string,
  filename: string
): Promise<void> => {
  const pdf = new jsPDF();
  
  // Simple text document generation
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

export const generateEnrollmentDeclaration = async (
  enrollment: PreEnrollment,
  settings: SystemSettings
): Promise<Blob> => {
  const pdf = new jsPDF();
  
  let yPosition = 20;

  // Add logo if available
  if (settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = logo.width;
      canvas.height = logo.height;
      ctx?.drawImage(logo, 0, 0);
      const logoData = canvas.toDataURL('image/jpeg');
      pdf.addImage(logoData, 'JPEG', 15, yPosition, 30, 20);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Header information
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(settings.institution_name, 50, yPosition + 5);
  pdf.text(settings.institution_address, 50, yPosition + 10);
  pdf.text(`CEP: ${settings.institution_cep} - CNPJ: ${settings.institution_cnpj}`, 50, yPosition + 15);
  pdf.text(`Tel: ${settings.institution_phone} - Email: ${settings.institution_email}`, 50, yPosition + 20);

  yPosition += 50;

  // Title - centered and bold
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARAÇÃO DE MATRÍCULA', 105, yPosition, { align: 'center' });

  yPosition += 25;

  // Declaration content
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');

  const declarationText = `Declaramos para os devidos fins que ${enrollment.full_name.toUpperCase()}, portador(a) do CPF nº ${enrollment.cpf || 'não informado'}, ${enrollment.organization || ''}, encontra-se regularmente matriculado(a) no curso de "${enrollment.course.name.toUpperCase()}".

O referido curso possui carga horária de ${enrollment.course.duration_hours || 390} (${numberToWords(enrollment.course.duration_hours || 390)}) horas, sendo realizado na modalidade de Ensino a Distância (EAD), com datas a serem definidas.

O curso está devidamente registrado em nossa instituição e atende aos requisitos necessários para fins de capacitação profissional e licença para capacitação.

Declaramos ainda que o estudante terá acompanhamento pedagógico especializado durante todo o período do curso, com acesso a materiais didáticos atualizados e suporte técnico-pedagógico.`;

  const splitText = pdf.splitTextToSize(declarationText, 170);
  pdf.text(splitText, 20, yPosition);

  yPosition += splitText.length * 5 + 20;

  // Additional info
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text('Esta declaração é válida para todos os fins de direito.', 20, yPosition);

  yPosition += 20;

  // Date and location
  pdf.setFont('helvetica', 'normal');
  pdf.text(`São Paulo, ${new Date().toLocaleDateString('pt-BR')}.`, 20, yPosition);

  // Ensure we have enough space for signature area
  if (yPosition > 220) {
    pdf.addPage();
    yPosition = 60;
  } else {
    yPosition += 40;
  }

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
      pdf.addImage(signatureData, 'PNG', 20, yPosition - 10, 40, 15);
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  }

  pdf.line(20, yPosition + 5, 100, yPosition + 5);
  pdf.text(settings.director_name, 20, yPosition + 10);
  pdf.text(settings.director_title, 20, yPosition + 15);

  // Stamp area indication
  pdf.setFontSize(8);
  pdf.text('(CARIMBO E ASSINATURA)', 120, yPosition + 10);

  return pdf.output('blob');
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