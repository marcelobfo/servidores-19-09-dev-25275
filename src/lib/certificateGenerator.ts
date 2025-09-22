import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface CertificateData {
  id: string;
  studentName: string;
  courseName: string;
  courseModules: string;
  issueDate: Date;
  completionDate: Date;
  certificateCode: string;
  verificationUrl: string;
  courseHours: number;
}

interface SystemSettings {
  institution_name: string;
  institution_address: string;
  institution_cnpj: string;
  director_name: string;
  director_title: string;
  logo_url?: string;
  director_signature_url?: string;
  certificate_front_bg_url?: string | null;
  certificate_back_bg_url?: string | null;
  abed_seal_url?: string | null;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

const formatCourse = (courseName: string): string => {
  return courseName.toUpperCase();
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const numberToWords = (num: number): string => {
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  if (num === 0) return 'zero';
  if (num === 100) return 'cem';
  
  let result = '';
  
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    num %= 100;
    if (num > 0) result += ' e ';
  }
  
  if (num >= 20) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
    if (num > 0) result += ' e ';
  } else if (num >= 10) {
    result += teens[num - 10];
    num = 0;
  }
  
  if (num > 0) {
    result += units[num];
  }
  
  return result;
};

export const generateCertificate = async (
  certificateData: Pick<CertificateData, 'studentName' | 'courseName' | 'completionDate' | 'certificateCode'>,
  settings?: SystemSettings
): Promise<void> => {
  // Simple certificate generation without full data
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Certificate content
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CERTIFICADO', pageWidth / 2, 50, { align: 'center' });

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Certificamos que ${certificateData.studentName}`, pageWidth / 2, 80, { align: 'center' });
  pdf.text(`concluiu o curso ${certificateData.courseName}`, pageWidth / 2, 100, { align: 'center' });
  pdf.text(`em ${certificateData.completionDate.toLocaleDateString('pt-BR')}`, pageWidth / 2, 120, { align: 'center' });
  pdf.text(`Código: ${certificateData.certificateCode}`, pageWidth / 2, 140, { align: 'center' });

  pdf.save(`certificado-${certificateData.certificateCode}.pdf`);
};

export const generateCertificateWithFullData = async (
  certificateData: CertificateData,
  settings: SystemSettings
): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Generate QR Code
  const qrCodeDataUrl = await QRCode.toDataURL(certificateData.verificationUrl, {
    width: 100,
    margin: 1
  });

// Page 1 - Certificate
// Background image (optional)
try {
  if (settings.certificate_front_bg_url) {
    const bgFront = await loadImage(settings.certificate_front_bg_url);
    pdf.addImage(bgFront, 'PNG', 0, 0, pageWidth, pageHeight);
  }
} catch (e) {
  console.warn('Could not load front background:', e);
}
// Add decorative border with improved blue color
  pdf.setDrawColor(30, 64, 175); // Professional blue color #1E40AF
  pdf.setLineWidth(4);
  pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);
  
  pdf.setLineWidth(2);
  pdf.setDrawColor(59, 130, 246); // Lighter blue #3B82F6
  pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Add corner decorations with improved design
  pdf.setFillColor(30, 64, 175); // Professional blue
  const cornerSize = 12;
  const cornerThickness = 3;
  
  // Top corners
  pdf.rect(18, 18, cornerSize, cornerThickness, 'F');
  pdf.rect(18, 18, cornerThickness, cornerSize, 'F');
  pdf.rect(pageWidth - 30, 18, cornerSize, cornerThickness, 'F');
  pdf.rect(pageWidth - 21, 18, cornerThickness, cornerSize, 'F');
  
  // Bottom corners
  pdf.rect(18, pageHeight - 21, cornerSize, cornerThickness, 'F');
  pdf.rect(18, pageHeight - 30, cornerThickness, cornerSize, 'F');
  pdf.rect(pageWidth - 30, pageHeight - 21, cornerSize, cornerThickness, 'F');
  pdf.rect(pageWidth - 21, pageHeight - 30, cornerThickness, cornerSize, 'F');

  // Institution logo (if available)
  if (settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      pdf.addImage(logo, 'PNG', 30, 30, 40, 20);
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  // Institution name with improved styling
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175); // Professional blue
  const institutionText = settings.institution_name.toUpperCase();
  const institutionWidth = pdf.getTextWidth(institutionText);
  pdf.text(institutionText, (pageWidth - institutionWidth) / 2, 45);

  // "CERTIFICADO" title with enhanced styling
  pdf.setFontSize(36);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175); // Professional blue
  const certTitle = 'CERTIFICADO';
  const certTitleWidth = pdf.getTextWidth(certTitle);
  pdf.text(certTitle, (pageWidth - certTitleWidth) / 2, 75);
  
  // Add decorative line under title
  pdf.setLineWidth(2);
  pdf.setDrawColor(59, 130, 246);
  const lineStart = (pageWidth - certTitleWidth) / 2;
  const lineEnd = lineStart + certTitleWidth;
  pdf.line(lineStart, 80, lineEnd, 80);

  // Main certificate text with improved formatting
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  const mainText = `Certificamos que`;
  const mainTextWidth = pdf.getTextWidth(mainText);
  pdf.text(mainText, (pageWidth - mainTextWidth) / 2, 100);

  // Student name in larger, bold font
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  const studentText = certificateData.studentName.toUpperCase();
  const studentTextWidth = pdf.getTextWidth(studentText);
  pdf.text(studentText, (pageWidth - studentTextWidth) / 2, 112);

  // Course completion text
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  const completedText = `concluiu com aproveitamento o curso de`;
  const completedTextWidth = pdf.getTextWidth(completedText);
  pdf.text(completedText, (pageWidth - completedTextWidth) / 2, 124);

  // Course name with special formatting
  pdf.setFontSize(17);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  const courseText = formatCourse(certificateData.courseName);
  const courseTextWidth = pdf.getTextWidth(courseText);
  pdf.text(courseText, (pageWidth - courseTextWidth) / 2, 136);

  // Hours information
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  const hoursText = `com carga horária de ${certificateData.courseHours} (${numberToWords(certificateData.courseHours)}) horas,`;
  const hoursTextWidth = pdf.getTextWidth(hoursText);
  pdf.text(hoursText, (pageWidth - hoursTextWidth) / 2, 148);

  // Completion period
  const periodText = `realizado no período de ${formatDate(certificateData.completionDate)}.`;
  const periodTextWidth = pdf.getTextWidth(periodText);
  pdf.text(periodText, (pageWidth - periodTextWidth) / 2, 158);

  // Date and location
  const dateText = `São Paulo, ${formatDate(certificateData.issueDate)}.`;
  const dateTextWidth = pdf.getTextWidth(dateText);
  pdf.text(dateText, (pageWidth - dateTextWidth) / 2, 175);

  // Director signature area
  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      pdf.addImage(signature, 'PNG', (pageWidth - 50) / 2, 185, 50, 25);
    } catch (error) {
      console.warn('Could not load signature:', error);
    }
  }

  // Signature line
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0);
  pdf.line((pageWidth - 80) / 2, 210, (pageWidth + 80) / 2, 210);

  // Director info
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  const directorNameWidth = pdf.getTextWidth(settings.director_name);
  pdf.text(settings.director_name, (pageWidth - directorNameWidth) / 2, 218);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const directorTitleWidth = pdf.getTextWidth(settings.director_title);
  pdf.text(settings.director_title, (pageWidth - directorTitleWidth) / 2, 225);

// Optional ABED seal
if (settings.abed_seal_url) {
  try {
    const abed = await loadImage(settings.abed_seal_url);
    pdf.addImage(abed, 'PNG', 20, pageHeight - 55, 30, 30);
  } catch (e) {
    console.warn('Could not load ABED seal:', e);
  }
}
// QR Code with label
pdf.addImage(qrCodeDataUrl, 'PNG', pageWidth - 45, pageHeight - 50, 30, 30);
pdf.setFontSize(8);
pdf.setTextColor(100, 100, 100);
pdf.text('Verificação Digital', pageWidth - 45, pageHeight - 15);

  // Certificate code
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  const codeText = `Código de Verificação: ${certificateData.certificateCode}`;
  pdf.text(codeText, 25, pageHeight - 30);
  
  // Verification URL
  pdf.setFontSize(8);
  const urlText = `Verifique em: ${window.location.origin}/verify-certificate/${certificateData.certificateCode}`;
  pdf.text(urlText, 25, pageHeight - 22);

// Page 2 - Course Content
pdf.addPage();

// Background image (optional)
try {
  if (settings.certificate_back_bg_url) {
    const bgBack = await loadImage(settings.certificate_back_bg_url);
    pdf.addImage(bgBack, 'PNG', 0, 0, pageWidth, pageHeight);
  }
} catch (e) {
  console.warn('Could not load back background:', e);
}

// Header with improved styling
  pdf.setFillColor(30, 64, 175); // Professional blue
  pdf.rect(0, 0, pageWidth, 30, 'F');
  
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  const contentTitle = 'CONTEÚDO PROGRAMÁTICO';
  const contentTitleWidth = pdf.getTextWidth(contentTitle);
  pdf.text(contentTitle, (pageWidth - contentTitleWidth) / 2, 20);

  // Course name with improved styling
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  const courseNameWidth = pdf.getTextWidth(certificateData.courseName);
  pdf.text(certificateData.courseName, (pageWidth - courseNameWidth) / 2, 45);
  
  // Decorative line under course name
  pdf.setLineWidth(1);
  pdf.setDrawColor(59, 130, 246);
  const courseLineStart = (pageWidth - courseNameWidth) / 2;
  const courseLineEnd = courseLineStart + courseNameWidth;
  pdf.line(courseLineStart, 50, courseLineEnd, 50);

  // Modules content with improved formatting
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  // Parse modules from JSON string and format properly
  let modules: any[] = [];
  try {
    const parsedModules = JSON.parse(certificateData.courseModules);
    modules = Array.isArray(parsedModules) ? parsedModules : [];
  } catch (e) {
    console.warn('Could not parse modules JSON:', e);
    // Fallback: treat as plain text
    modules = certificateData.courseModules.split('\n').map((text, index) => ({
      id: index + 1,
      title: text.trim(),
      description: ''
    }));
  }
  let yPosition = 65;
  
  // Preload back background once for subsequent pages
  let backBg: HTMLImageElement | null = null;
  try {
    if (settings.certificate_back_bg_url) {
      backBg = await loadImage(settings.certificate_back_bg_url);
    }
  } catch (e) {
    console.warn('Could not load back background:', e);
  }
  
  modules.forEach((module, index) => {
    const moduleTitle = typeof module === 'string' ? module.trim() : module.title || `Módulo ${index + 1}`;
    const moduleDescription = typeof module === 'object' ? module.description || '' : '';
    
    if (moduleTitle) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        if (backBg) {
          pdf.addImage(backBg, 'PNG', 0, 0, pageWidth, pageHeight);
        }
        // Add header on new pages
        pdf.setFillColor(30, 64, 175);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('CONTEÚDO PROGRAMÁTICO (continuação)', pageWidth / 2, 16, { align: 'center' });
        yPosition = 35;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
      }
      
      // Add module number if it's not already numbered
      const moduleText = module.trim();
      const isNumbered = /^\d+[\.\)\-]/.test(moduleText);
      const displayText = isNumbered ? moduleText : `${index + 1}. ${moduleText}`;
      
      // Split long lines with better formatting
      const lines = pdf.splitTextToSize(displayText, pageWidth - 50);
      lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
          // First line with bullet point styling
          pdf.setFont('helvetica', 'bold');
          pdf.text('•', 25, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(line, 35, yPosition);
        } else {
          // Continuation lines indented
          pdf.text(line, 35, yPosition);
        }
        yPosition += 7;
      });
      yPosition += 3; // Extra spacing between modules
    }
  });

  // Legal note with improved formatting
  yPosition += 15;
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = 30;
  }
  
  // Add separator line
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(150, 150, 150);
  pdf.line(25, yPosition, pageWidth - 25, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  pdf.text('FUNDAMENTAÇÃO LEGAL:', 25, yPosition);
  yPosition += 8;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  const legalTexts = [
    'Este certificado é emitido com base na Lei nº 9.394/96 (Lei de Diretrizes e Bases da Educação Nacional),',
    'Decreto nº 5.154/04 e Deliberação CEE 14/97, sendo válido em todo território nacional.',
    '',
    'A autenticidade deste documento pode ser verificada através do código QR ou no endereço:',
    `${window.location.origin}/verify-certificate/${certificateData.certificateCode}`
  ];
  
  legalTexts.forEach((text) => {
    if (text.trim()) {
      const lines = pdf.splitTextToSize(text, pageWidth - 50);
      lines.forEach((line: string) => {
        pdf.text(line, 25, yPosition);
        yPosition += 5;
      });
    } else {
      yPosition += 3;
    }
  });
  
  // Add final QR code
  yPosition += 10;
  if (yPosition > pageHeight - 40) {
    pdf.addPage();
    yPosition = 30;
  }
  
  pdf.addImage(qrCodeDataUrl, 'PNG', pageWidth - 40, yPosition, 25, 25);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Verificação Digital', pageWidth - 40, yPosition + 30);

  return pdf.output('blob');
};