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
  effective_hours?: number;  // Carga horária efetiva (após multiplicador do tipo de órgão)
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

// Helper function to format CPF
const formatCPF = (cpf: string): string => {
  if (!cpf) return 'não informado';
  
  // Remove tudo que não é dígito
  const cleaned = cpf.replace(/\D/g, '');
  
  // Formata como XXX.XXX.XXX-XX
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  }
  
  return cpf; // Retorna original se não tiver 11 dígitos
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
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(settings.institution_name, 50, yPosition + 5);
  pdf.text(settings.institution_address, 50, yPosition + 9);
  pdf.text(`CEP: ${settings.institution_cep} - CNPJ: ${settings.institution_cnpj}`, 50, yPosition + 13);
  pdf.text(`Tel: ${settings.institution_phone} - Email: ${settings.institution_email}`, 50, yPosition + 17);

  yPosition += 35;

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PLANO DE ESTUDOS', 105, yPosition, { align: 'center' });

  yPosition += 15;

  // Course Info
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DADOS DO CURSO', 20, yPosition);
  
  yPosition += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Curso: ${enrollment.course.name}`, 20, yPosition);
  yPosition += 5;
  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours;
  pdf.text(`Carga Horária Total: ${effectiveHours} horas`, 20, yPosition);
  yPosition += 5;
  
  // Calculate duration in days
  let durationDays = 0;
  if (enrollment.course.start_date && enrollment.course.end_date) {
    const start = new Date(enrollment.course.start_date);
    const end = new Date(enrollment.course.end_date);
    durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  if (durationDays > 0) {
    pdf.text(`Duração: ${durationDays} dias`, 20, yPosition);
  }
  yPosition += 5;
  pdf.text(`Modalidade: Ensino à Distância (EAD)`, 20, yPosition);

  yPosition += 12;

  // Student Info Box
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('DADOS DO ESTUDANTE', 20, yPosition);
  
  yPosition += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Nome: ${enrollment.full_name}`, 20, yPosition);
  if (enrollment.cpf) {
    yPosition += 5;
    pdf.text(`CPF: ${formatCPF(enrollment.cpf)}`, 20, yPosition);
  }
  if (enrollment.organization) {
    yPosition += 5;
    pdf.text(`Instituição: ${enrollment.organization}`, 20, yPosition);
  }

  yPosition += 12;

  // Parse modules first to use in description
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

  // Calculate missing hours proportionally using effective hours
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
      // Recalcular proporcionalmente se há effective_hours diferente
      const ratio = effectiveHoursTotal / enrollment.course.duration_hours;
      modules = modules.map((m, i) => ({
        ...m,
        hours: i === modules.length - 1 
          ? effectiveHoursTotal - modules.slice(0, -1).reduce((sum, mod) => sum + Math.round(mod.hours * ratio), 0)
          : Math.round(m.hours * ratio)
      }));
    }
  }

  // Description of course (if modules have descriptions)
  const hasDescriptions = modules.some(m => m.description && m.description.trim());
  if (hasDescriptions) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('DESCRIÇÃO DO CURSO', 20, yPosition);
    yPosition += 7;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    modules.forEach((module, index) => {
      if (module.description && module.description.trim()) {
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`MÓDULO ${index + 1} - ${module.name.toUpperCase()}`, 20, yPosition);
        yPosition += 5;
        
        pdf.setFont('helvetica', 'normal');
        const descLines = pdf.splitTextToSize(module.description, 170);
        descLines.forEach((line: string) => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, 20, yPosition);
          yPosition += 4;
        });
        yPosition += 3;
      }
    });
    
    yPosition += 7;
  }

  // Course Content
  if (yPosition > 230) {
    pdf.addPage();
    yPosition = 20;
  }
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('CONTEÚDO PROGRAMÁTICO', 20, yPosition);

  yPosition += 8;

  // Table header - SEM FUNDO CINZA
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('MÓDULO', 25, yPosition);
  pdf.text('CARGA HORÁRIA', 155, yPosition);

  yPosition += 3;

  // Linha horizontal abaixo do header
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition, 190, yPosition);

  yPosition += 5;

  // Helper function to check page break needs
  const addPageBreakIfNeeded = (currentY: number, requiredSpace: number = 60): number => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginBottom = 50;
    
    if (currentY + requiredSpace > pageHeight - marginBottom) {
      pdf.addPage();
      return 20;
    }
    return currentY;
  };

  // Module table with actual module names
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  
  modules.forEach((module, index) => {
    yPosition = addPageBreakIfNeeded(yPosition, 10);
    
    const moduleName = module.name || `Módulo ${index + 1}`;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${index + 1}. ${moduleName}`, 25, yPosition);
    pdf.text(`${module.hours}h`, 160, yPosition);
    
    yPosition += 7;
  });

  // Linha final da tabela
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition, 190, yPosition);

  // Total
  yPosition += 3;
  pdf.setFont('helvetica', 'bold');
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition, 190, yPosition);
  yPosition += 5;
  // Usar effective_hours se disponível, senão calcular do total dos módulos
  const displayTotal = enrollment.course.effective_hours || modules.reduce((sum, module) => sum + module.hours, 0);
  pdf.text('TOTAL:', 25, yPosition);
  pdf.text(`${displayTotal}h`, 160, yPosition);

  yPosition += 12;
  yPosition = addPageBreakIfNeeded(yPosition, 70);

  // Methodology
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('METODOLOGIA', 20, yPosition);
  yPosition += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const methodologyText = 'O curso será desenvolvido na modalidade de Ensino a Distância (EAD), com aulas online, materiais didáticos digitais e acompanhamento tutorial. As atividades incluem videoaulas, exercícios práticos, fóruns de discussão e avaliações online.';
  const splitMethodology = pdf.splitTextToSize(methodologyText, 170);
  pdf.text(splitMethodology, 20, yPosition);
  yPosition += splitMethodology.length * 4 + 8;

  // Schedule
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('CRONOGRAMA DE ESTUDOS', 20, yPosition);
  yPosition += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Carga horária semanal recomendada: 20 horas', 20, yPosition);
  yPosition += 5;
  pdf.text('Horário de atendimento: Segunda a Sexta, 8h às 18h', 20, yPosition);
  yPosition += 5;
  pdf.text(`Plataforma: Sistema EAD ${settings.institution_name}`, 20, yPosition);

  // Forçar nova página para assinatura
  pdf.addPage();
  yPosition = 50;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  // Extrair cidade do endereço
  const addressParts = settings.institution_address.split('-');
  const city = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'São Paulo';

  pdf.text(`${city}, ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);

  yPosition += 20;

  // Assinatura do diretor
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = signature.width;
      canvas.height = signature.height;
      ctx?.drawImage(signature, 0, 0);
      const signatureData = canvas.toDataURL('image/png');
      pdf.addImage(signatureData, 'PNG', 20, yPosition, 40, 15);
      yPosition += 20;
    } catch (error) {
      console.error('Error loading signature:', error);
      yPosition += 15;
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition, 80, yPosition);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, 20, yPosition + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(settings.director_title, 20, yPosition + 10);

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

  yPosition += 45;

  // Title - centered and bold
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARAÇÃO DE MATRÍCULA', 105, yPosition, { align: 'center' });

  yPosition += 20;

  // Declaration content
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const orgText = enrollment.organization ? ` ${enrollment.organization}` : '';
  const effectiveHours = enrollment.course.effective_hours || enrollment.course.duration_hours || 390;
  const declarationText = `Declaramos para os devidos fins que ${enrollment.full_name.toUpperCase()}, portador(a) do CPF nº ${formatCPF(enrollment.cpf || '')},${orgText} encontra-se regularmente matriculado(a) no curso de "${enrollment.course.name.toUpperCase()}".

O referido curso possui carga horária de ${effectiveHours} (${numberToWords(effectiveHours)}) horas, sendo realizado na modalidade de Ensino a Distância (EAD), com datas a serem definidas.

O curso está devidamente registrado em nossa instituição e atende aos requisitos necessários para fins de capacitação profissional e licença para capacitação.

Declaramos ainda que o estudante terá acompanhamento pedagógico especializado durante todo o período do curso, com acesso a materiais didáticos atualizados e suporte técnico-pedagógico.

Esta declaração é válida para todos os fins de direito.`;

  const splitText = pdf.splitTextToSize(declarationText, 170);
  pdf.text(splitText, 20, yPosition);

  yPosition += splitText.length * 5.5 + 15;

  // Date and location
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  // Extrair cidade do endereço
  const addressParts = settings.institution_address.split('-');
  const city = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'São Paulo';
  
  pdf.text(`${city}, ${new Date().toLocaleDateString('pt-BR')}.`, 20, yPosition);

  // Ensure we have enough space for signature area
  if (yPosition > 220) {
    pdf.addPage();
    yPosition = 50;
  } else {
    yPosition += 30;
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
      pdf.addImage(signatureData, 'PNG', 20, yPosition - 8, 40, 15);
    } catch (error) {
      console.error('Error loading signature:', error);
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(20, yPosition + 8, 90, yPosition + 8);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, 20, yPosition + 13);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(settings.director_title, 20, yPosition + 18);

  // Stamp area indication
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(CARIMBO E ASSINATURA)', 95, yPosition + 13);

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