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
  
  let yPos = 25;

  // Add institution header with proper formatting
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("JVR TREINAMENTOS", 20, yPos);
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  yPos += 6;
  pdf.text("Infomar Cursos Livres/JMR Empreendimentos digitais", 20, yPos);
  yPos += 5;
  pdf.text("Av. Paulista, 1636 CJ 4 – São Paulo - SP", 20, yPos);
  yPos += 5;
  pdf.text(`CEP: ${settings?.institution_cep || '01310-200'} - CNPJ: ${settings?.institution_cnpj || '41.651.963/0001-32'}`, 20, yPos);
  yPos += 5;
  pdf.text(`Tel: ${settings?.institution_phone || '(61) 99296-8232'} - Email: ${settings?.institution_email || 'infomarcursos@infomarcursos.com.br'}`, 20, yPos);
  
  // Add line separator
  yPos += 6;
  pdf.setLineWidth(0.5);
  pdf.line(20, yPos, 190, yPos);
  
  // Title
  yPos += 18;
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("PLANO DE ESTUDOS", 105, yPos, { align: "center" });

  // Add sections
  yPos += 15;
  
  // Course data
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("DADOS DO CURSO", 20, yPos);
  
  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Curso: ${enrollment.course.name.toUpperCase()}`, 20, yPos);
  yPos += 6;
  pdf.text(`Carga Horária Total: ${enrollment.course.duration_hours || 390} horas`, 20, yPos);
  yPos += 6;
  pdf.text("Modalidade: Ensino à Distância (EAD)", 20, yPos);
  
  yPos += 12;
  
  // Student data
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("DADOS DO ESTUDANTE", 20, yPos);
  
  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Nome: ${enrollment.full_name}`, 20, yPos);
  yPos += 6;
  pdf.text(`CPF: ${enrollment.cpf || "não informado"}`, 20, yPos);
  yPos += 6;
  if (enrollment.organization) {
    pdf.text(`Instituição: ${enrollment.organization}`, 20, yPos);
    yPos += 6;
  }
  
  yPos += 10;

  // Program content (modules) - Create proper table
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("CONTEÚDO PROGRAMÁTICO", 20, yPos);
  
  yPos += 10;
  
  if (enrollment.course.modules) {
    try {
      const parsedModules = JSON.parse(enrollment.course.modules);
      let modulesList: any[] = [];
      
      if (parsedModules.módulos && Array.isArray(parsedModules.módulos)) {
        modulesList = parsedModules.módulos;
      } else if (Array.isArray(parsedModules)) {
        modulesList = parsedModules;
      }
      
      if (modulesList.length > 0) {
        // Draw table with borders
        const startX = 20;
        const startY = yPos;
        const col1Width = 120;
        const col2Width = 50;
        const rowHeight = 8;
        
        // Table header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(startX, startY, col1Width, rowHeight, 'F');
        pdf.rect(startX + col1Width, startY, col2Width, rowHeight, 'F');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("MÓDULO", startX + 2, startY + 6);
        pdf.text("CARGA HORÁRIA", startX + col1Width + 2, startY + 6);
        
        // Draw header borders
        pdf.rect(startX, startY, col1Width, rowHeight);
        pdf.rect(startX + col1Width, startY, col2Width, rowHeight);
        
        yPos += rowHeight;
        
        // Table rows
        pdf.setFont("helvetica", "normal");
        modulesList.forEach((m, i) => {
          const moduleName = typeof m === 'string' ? m : (m.nome || m.name || m.title || `${i + 1}. Módulo`);
          const hours = typeof m === 'object' ? (m.carga_horaria || m.workload || m.horas || m.hours || '') : '';
          
          // Draw row
          pdf.text(`${i + 1}. ${moduleName}`, startX + 2, yPos + 6);
          pdf.text(hours ? `${hours}h` : '', startX + col1Width + 2, yPos + 6);
          
          // Draw borders
          pdf.rect(startX, yPos, col1Width, rowHeight);
          pdf.rect(startX + col1Width, yPos, col2Width, rowHeight);
          
          yPos += rowHeight;
        });
        
        yPos += 8;
        pdf.setFont("helvetica", "bold");
        pdf.text(`CARGA HORÁRIA TOTAL: ${enrollment.course.duration_hours || 390}h`, 20, yPos);
        yPos += 12;
      }
    } catch (e) {
      console.warn("Could not parse modules:", e);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Conteúdo a ser definido", 20, yPos);
      yPos += 12;
    }
  } else {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Conteúdo a ser definido", 20, yPos);
    yPos += 12;
  }

  // Methodology
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("METODOLOGIA", 20, yPos);
  
  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const methodologyText = "O curso será desenvolvido na modalidade de Ensino a Distância (EAD), com aulas online, materiais didáticos digitais e acompanhamento tutorial. As atividades incluem videoaulas, exercícios práticos, fóruns de discussão e avaliações online.";
  const methodologyLines = pdf.splitTextToSize(methodologyText, 170);
  pdf.text(methodologyLines, 20, yPos);
  yPos += (methodologyLines.length * 6) + 12;
  
  // Study schedule
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("CRONOGRAMA DE ESTUDOS", 20, yPos);
  
  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Carga horária semanal recomendada: 20 horas", 20, yPos);
  yPos += 6;
  pdf.text("Horário de atendimento: Segunda a Sexta, 8h às 18h", 20, yPos);
  yPos += 6;
  pdf.text("Plataforma: Sistema EAD Infomar Cursos", 20, yPos);
  yPos += 15;

  // Add new page if needed
  if (yPos > 240) {
    pdf.addPage();
    yPos = 30;
  }
  
  // Signature
  const currentDate = new Date().toLocaleDateString('pt-BR');
  pdf.text(`São Paulo, ${currentDate}.`, 20, yPos);
  yPos += 15;
  
  if (settings?.director_signature_url) {
    try {
      const signatureImg = await loadImage(settings.director_signature_url);
      pdf.addImage(signatureImg, 'PNG', 20, yPos, 60, 20);
    } catch (e) {
      console.warn("Could not load signature image:", e);
    }
  }
  
  yPos += 25;
  
  pdf.setFont("helvetica", "normal");
  pdf.text("_".repeat(60), 20, yPos);
  yPos += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text(settings?.director_name || "José Victor Furtado J. F de Oliveira", 20, yPos);
  yPos += 5;
  pdf.setFont("helvetica", "normal");
  pdf.text(settings?.director_title || "Diretor Acadêmico Infomar Cursos Livres", 20, yPos);

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
  const doc = new jsPDF();
  const currentDate = new Date().toLocaleDateString('pt-BR');
  const studentName = enrollment.full_name;
  const courseName = enrollment.course.name;
  const cpf = enrollment.cpf;
  const organization = enrollment.organization;
  const durationHours = enrollment.course.duration_hours || 390;

  // Add institution header with proper formatting
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("JVR TREINAMENTOS", 20, 25);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Infomar Cursos Livres/JMR Empreendimentos digitais", 20, 31);
  doc.text("Av. Paulista, 1636 CJ 4 – São Paulo - SP", 20, 36);
  doc.text(`CEP: ${settings?.institution_cep || '01310-200'} - CNPJ: ${settings?.institution_cnpj || '41.651.963/0001-32'}`, 20, 41);
  doc.text(`Tel: ${settings?.institution_phone || '(61) 99296-8232'} - Email: ${settings?.institution_email || 'infomarcursos@infomarcursos.com.br'}`, 20, 46);
  
  // Add line separator
  doc.setLineWidth(0.5);
  doc.line(20, 52, 190, 52);
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DECLARAÇÃO DE MATRÍCULA", 105, 70, { align: "center" });

  // Declaration text with proper formatting
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  let yPos = 85;
  
  const declarationText = `Declaramos para os devidos fins que ${studentName.toUpperCase()}, portador(a) do CPF nº ${cpf || 'não informado'}, ${organization || ''}, encontra-se regularmente matriculado(a) no curso de "${courseName.toUpperCase()}".

O referido curso possui carga horária de ${durationHours} (${numberToWords(durationHours)}) horas, sendo realizado na modalidade de Ensino a Distância (EAD), com datas a serem definidas.

O curso está devidamente registrado em nossa instituição e atende aos requisitos necessários para fins de capacitação profissional e licença para capacitação.

Declaramos ainda que o estudante terá acompanhamento pedagógico especializado durante todo o período do curso, com acesso a materiais didáticos atualizados e suporte técnico-pedagógico.

Esta declaração é válida para todos os fins de direito.`;

  const lines = doc.splitTextToSize(declarationText, 170);
  doc.text(lines, 20, yPos);
  
  yPos += (lines.length * 6) + 15;

  // Signature section with proper spacing
  doc.setFontSize(11);
  doc.text(`São Paulo, ${currentDate}.`, 20, yPos);
  
  yPos += 25;
  
  if (settings?.director_signature_url) {
    // Add signature image if available
    try {
      const signatureImg = await loadImage(settings.director_signature_url);
      doc.addImage(signatureImg, 'PNG', 20, yPos, 60, 20);
    } catch (e) {
      console.warn("Could not load signature image:", e);
    }
  }
  
  yPos += 25;
  
  doc.setFont("helvetica", "normal");
  doc.text("_".repeat(60), 20, yPos);
  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text(settings?.director_name || "José Victor Furtado J. F de Oliveira", 20, yPos);
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text("(CARIMBO E ASSINATURA)", 20, yPos);
  yPos += 5;
  doc.text(settings?.director_title || "Diretor Acadêmico Infomar Cursos Livres", 20, yPos);

  return doc.output('blob');
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
