import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { DocumentTemplate, ContentBlock, FrameStyle } from '@/types/document-templates';

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
  weekly_hours?: number; // Carga horária semanal (20h federal, 30h outros)
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
  course_content?: string;
  modules: Array<{ name: string; hours: number }>;
}

// Helper function to load image from URL with CORS support and retry
const loadImage = (url: string, timeout: number = 8000): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn('Image load timeout for:', url);
      reject(new Error(`Image load timeout for: ${url}`));
    }, timeout);
    
    // First try with crossOrigin (required for canvas export)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      clearTimeout(timeoutId);
      console.log('Image loaded with crossOrigin:', url.substring(0, 50));
      resolve(img);
    };
    
    img.onerror = () => {
      console.log('First load attempt failed, retrying without crossOrigin for:', url);
      
      // Retry without crossOrigin (may work for same-origin but won't support canvas export)
      const img2 = new Image();
      
      img2.onload = () => {
        clearTimeout(timeoutId);
        console.log('Image loaded without crossOrigin:', url.substring(0, 50));
        resolve(img2);
      };
      
      img2.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('Image load failed for:', url);
        reject(new Error(`Image load failed for: ${url}`));
      };
      
      img2.src = url;
    };
    
    img.src = url;
  });
};

// Helper to safely convert image to data URL (handles CORS issues)
const imageToDataURL = (img: HTMLImageElement): string | null => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Could not convert image to data URL (CORS issue):', error);
    return null;
  }
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
      yPosition = await renderHeader(pdf, block, settings, yPosition, margins.left);
      break;

    case 'title':
    case 'paragraph':
      yPosition = renderText(pdf, block, data, settings, yPosition, margins, contentWidth);
      break;

    case 'signature':
      yPosition = await renderSignature(pdf, block, settings, yPosition, margins.left);
      break;

    case 'image':
      yPosition = await renderImage(pdf, block, settings, yPosition, margins);
      break;

    case 'footer':
      renderFooter(pdf, block, data, settings);
      break;

    case 'modules_table':
      yPosition = renderModulesTable(pdf, data, yPosition, margins.left, contentWidth, block);
      break;

    case 'cronograma_table':
      yPosition = renderCronogramaTable(pdf, data, settings, yPosition, margins.left, block);
      break;

    case 'quote_table':
      yPosition = renderQuoteTable(pdf, data, yPosition, margins.left, contentWidth, block);
      break;

    case 'spacer':
      yPosition += block.config.marginTop || 20;
      break;

    case 'qrcode':
      yPosition = await renderQRCode(pdf, data, block, yPosition, margins);
      break;

    case 'frame':
      await renderFrame(pdf, block);
      break;

    case 'course_content':
      yPosition = renderCourseContent(pdf, block, data, yPosition, margins, contentWidth);
      break;
  }

  // Apply margin bottom
  yPosition += block.config.marginBottom || 0;

  return yPosition;
};

// Render QR Code with alignment support
const renderQRCode = async (
  pdf: jsPDF,
  data: PreviewData,
  block: ContentBlock,
  yPosition: number,
  margins: { left: number; right: number }
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const qrSize = block.config.width || 60;
  const qrcodeAlign = block.config.qrcodeAlign || 'center';
  
  // Calculate X position based on alignment
  let qrX: number;
  switch (qrcodeAlign) {
    case 'left':
      qrX = margins.left;
      break;
    case 'right':
      qrX = pageWidth - margins.right - qrSize;
      break;
    default:
      qrX = (pageWidth - qrSize) / 2;
  }
  
  try {
    const verificationUrl = data.verification_url || `https://exemplo.com/verify/${data.certificate_code || 'CERT-XXXX'}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 1
    });
    
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX, yPosition, qrSize, qrSize);
    yPosition += qrSize + 5;
    
    // Add verification text with same alignment
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    const textX = qrcodeAlign === 'center' ? pageWidth / 2 
      : qrcodeAlign === 'right' ? pageWidth - margins.right 
      : margins.left;
    pdf.text('Verificação Digital', textX, yPosition, { align: qrcodeAlign as any });
    pdf.setTextColor(0, 0, 0);
    yPosition += 5;
  } catch (error) {
    console.warn('Could not generate QR Code:', error);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(qrX, yPosition, qrSize, qrSize);
    pdf.setFontSize(8);
    pdf.text('QR Code', qrX + qrSize / 2, yPosition + qrSize / 2);
    yPosition += qrSize + 5;
  }
  
  return yPosition;
};

// Render standalone image block with alignment support
const renderImage = async (
  pdf: jsPDF,
  block: ContentBlock,
  settings: SystemSettings,
  yPosition: number,
  margins: { left: number; right: number }
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imageSource = block.config.imageSource || 'system-logo';
  const blockAlign = block.config.blockAlign || 'center';
  const imgWidth = block.config.width || 40;
  const imgHeight = block.config.height || 30;
  
  // Determine image URL based on source
  let imageUrl: string | undefined;
  switch (imageSource) {
    case 'system-logo':
      imageUrl = settings.logo_url;
      break;
    case 'director-signature':
      imageUrl = settings.director_signature_url;
      break;
    case 'custom-url':
      imageUrl = block.config.imageUrl;
      break;
  }
  
  if (!imageUrl) {
    console.warn('No image URL provided for image block');
    return yPosition;
  }
  
  // Calculate X position based on alignment
  let imgX: number;
  switch (blockAlign) {
    case 'left':
      imgX = margins.left;
      break;
    case 'right':
      imgX = pageWidth - margins.right - imgWidth;
      break;
    default:
      imgX = (pageWidth - imgWidth) / 2;
  }
  
  try {
    const img = await loadImage(imageUrl);
    const imgData = imageToDataURL(img);
    if (imgData) {
      pdf.addImage(imgData, 'PNG', imgX, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 5;
    }
  } catch (error) {
    console.warn('Image could not be loaded:', error);
    // Draw placeholder
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(imgX, yPosition, imgWidth, imgHeight);
    pdf.setFontSize(8);
    pdf.text('Imagem', imgX + imgWidth / 2, yPosition + imgHeight / 2, { align: 'center' });
    yPosition += imgHeight + 5;
  }
  
  return yPosition;
};

// Render decorative frame/border
const renderFrame = async (pdf: jsPDF, block: ContentBlock): Promise<void> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const frameStyle = block.config.frameStyle || 'classic';
  const frameColor = block.config.frameColor || '#1E40AF';
  const frameWidth = block.config.frameWidth || 4;
  
  // Parse color from hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 30, g: 64, b: 175 };
  };
  
  const color = hexToRgb(frameColor);
  
  switch (frameStyle) {
    case 'none':
      break;
      
    case 'simple':
      pdf.setDrawColor(color.r, color.g, color.b);
      pdf.setLineWidth(frameWidth);
      pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);
      break;
      
    case 'double':
      pdf.setDrawColor(color.r, color.g, color.b);
      pdf.setLineWidth(frameWidth);
      pdf.rect(6, 6, pageWidth - 12, pageHeight - 12);
      pdf.setLineWidth(frameWidth / 2);
      pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);
      break;
      
    case 'classic':
      // Outer border
      pdf.setDrawColor(color.r, color.g, color.b);
      pdf.setLineWidth(frameWidth);
      pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);
      
      // Inner border (lighter)
      pdf.setLineWidth(frameWidth / 2);
      const lighterColor = { r: Math.min(color.r + 80, 255), g: Math.min(color.g + 80, 255), b: Math.min(color.b + 80, 255) };
      pdf.setDrawColor(lighterColor.r, lighterColor.g, lighterColor.b);
      pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);
      
      // Corner decorations
      pdf.setFillColor(color.r, color.g, color.b);
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
      break;
      
    case 'elegant':
      // Triple border effect
      pdf.setDrawColor(color.r, color.g, color.b);
      pdf.setLineWidth(1);
      pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);
      
      pdf.setLineWidth(frameWidth);
      pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      
      pdf.setLineWidth(1);
      pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);
      
      // Elegant corner accents
      const accentSize = 20;
      pdf.setLineWidth(2);
      
      // Top-left corner
      pdf.line(20, 20, 20 + accentSize, 20);
      pdf.line(20, 20, 20, 20 + accentSize);
      
      // Top-right corner
      pdf.line(pageWidth - 20, 20, pageWidth - 20 - accentSize, 20);
      pdf.line(pageWidth - 20, 20, pageWidth - 20, 20 + accentSize);
      
      // Bottom-left corner
      pdf.line(20, pageHeight - 20, 20 + accentSize, pageHeight - 20);
      pdf.line(20, pageHeight - 20, 20, pageHeight - 20 - accentSize);
      
      // Bottom-right corner
      pdf.line(pageWidth - 20, pageHeight - 20, pageWidth - 20 - accentSize, pageHeight - 20);
      pdf.line(pageWidth - 20, pageHeight - 20, pageWidth - 20, pageHeight - 20 - accentSize);
      break;
      
    case 'modern':
      // Clean modern border with accent lines
      pdf.setDrawColor(color.r, color.g, color.b);
      pdf.setLineWidth(frameWidth);
      pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      
      // Top accent line
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.rect(10, 10, pageWidth - 20, 3, 'F');
      
      // Bottom accent line
      pdf.rect(10, pageHeight - 13, pageWidth - 20, 3, 'F');
      break;
  }
};

// Render header with flexible positioning
const renderHeader = async (
  pdf: jsPDF,
  block: ContentBlock,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const showLogo = block.config.showLogo !== false;
  const showInstitutionInfo = block.config.showInstitutionInfo !== false;
  const headerLayout = block.config.headerLayout || 'logo-left';
  const logoAlign = block.config.logoAlign || 'left';
  const infoAlign = block.config.infoAlign || 'left';
  
  let logoLoaded = false;
  let logoData: string | null = null;
  const logoWidth = 25;
  const logoHeight = 18;

  console.log('renderHeader:', { showLogo, showInstitutionInfo, headerLayout, logoAlign, infoAlign });

  // Try to load logo
  if (showLogo && settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      logoData = imageToDataURL(logo);
      if (logoData) {
        logoLoaded = true;
        console.log('Logo loaded successfully');
      }
    } catch (error) {
      console.warn('Logo could not be loaded:', error);
    }
  }

  // Calculate logo X position based on alignment
  const getAlignedX = (align: string, elementWidth: number): number => {
    switch (align) {
      case 'center': return (pageWidth - elementWidth) / 2;
      case 'right': return pageWidth - marginLeft - elementWidth;
      default: return marginLeft;
    }
  };

  // Layout: Logo Above Info
  if (headerLayout === 'logo-above') {
    if (logoLoaded && logoData) {
      const logoX = getAlignedX(logoAlign, logoWidth);
      pdf.addImage(logoData, 'PNG', logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 5;
    }
    
    if (showInstitutionInfo) {
      const textAlign = infoAlign as 'left' | 'center' | 'right';
      let textX = marginLeft;
      if (infoAlign === 'center') textX = pageWidth / 2;
      else if (infoAlign === 'right') textX = pageWidth - marginLeft;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(settings.institution_name, textX, yPosition + 6, { align: textAlign });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Cursos Online e Presenciais', textX, yPosition + 11, { align: textAlign });
      pdf.text(settings.institution_address, textX, yPosition + 15, { align: textAlign });
      pdf.text(`CEP: ${settings.institution_cep}`, textX, yPosition + 19, { align: textAlign });
      yPosition += 25;
    }
    
    return yPosition;
  }

  // Layout: Logo Left/Center/Right with Info beside
  if (headerLayout === 'logo-center') {
    // Center layout - logo in center, info below
    if (logoLoaded && logoData) {
      const logoX = (pageWidth - logoWidth) / 2;
      pdf.addImage(logoData, 'PNG', logoX, yPosition, logoWidth, logoHeight);
    }
    
    if (showInstitutionInfo) {
      const textY = logoLoaded ? yPosition + logoHeight + 5 : yPosition;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(settings.institution_name, pageWidth / 2, textY + 6, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Cursos Online e Presenciais', pageWidth / 2, textY + 11, { align: 'center' });
      return textY + 20;
    }
    
    return yPosition + (logoLoaded ? logoHeight + 5 : 0);
  }

  if (headerLayout === 'logo-right') {
    // Logo on right, info on left
    if (logoLoaded && logoData) {
      const logoX = pageWidth - marginLeft - logoWidth;
      pdf.addImage(logoData, 'PNG', logoX, yPosition, logoWidth, logoHeight);
    }
    
    if (showInstitutionInfo) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(settings.institution_name, marginLeft, yPosition + 6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Cursos Online e Presenciais', marginLeft, yPosition + 11);
      pdf.text(settings.institution_address, marginLeft, yPosition + 15);
      pdf.text(`CEP: ${settings.institution_cep}`, marginLeft, yPosition + 19);
      return yPosition + 30;
    }
    
    return yPosition + (logoLoaded ? logoHeight + 5 : 0);
  }

  // Default: logo-left - Logo on left, info beside
  if (logoLoaded && logoData) {
    pdf.addImage(logoData, 'PNG', marginLeft, yPosition, logoWidth, logoHeight);
  }

  if (showInstitutionInfo) {
    const textStartX = logoLoaded ? marginLeft + logoWidth + 5 : marginLeft;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(settings.institution_name, textStartX, yPosition + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('Cursos Online e Presenciais', textStartX, yPosition + 11);
    pdf.text(settings.institution_address, textStartX, yPosition + 15);
    pdf.text(`CEP: ${settings.institution_cep}`, textStartX, yPosition + 19);
    return yPosition + 30;
  }

  return yPosition + (logoLoaded ? logoHeight + 5 : 0);
};

// Helper function to strip HTML and extract clean text for PDF
const stripHtmlForPdf = (html: string): string => {
  // Decode HTML entities
  let decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Preserve line breaks from block elements
  decoded = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ');
  
  // Remove all HTML tags (including <strong>, <em>, etc - jsPDF doesn't support inline formatting)
  decoded = decoded.replace(/<[^>]+>/g, '');
  
  // Clean up excessive whitespace
  return decoded
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
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
  const rawText = replaceVariables(block.config.text || '', data, settings);
  const text = stripHtmlForPdf(rawText);
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

// Render signature with alignment support
const renderSignature = async (
  pdf: jsPDF,
  block: ContentBlock,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number
): Promise<number> => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const signatureAlign = block.config.signatureAlign || 'left';
  const lineWidth = 70;
  const signatureImgWidth = 40;
  const signatureImgHeight = 15;
  
  // Calculate X position based on alignment
  let xPosition: number;
  switch (signatureAlign) {
    case 'center':
      xPosition = (pageWidth - lineWidth) / 2;
      break;
    case 'right':
      xPosition = pageWidth - marginLeft - lineWidth;
      break;
    default:
      xPosition = marginLeft;
  }

  if (settings.director_signature_url) {
    try {
      const signature = await loadImage(settings.director_signature_url);
      const signatureData = imageToDataURL(signature);
      if (signatureData) {
        const imgX = signatureAlign === 'center' 
          ? (pageWidth - signatureImgWidth) / 2 
          : signatureAlign === 'right' 
            ? pageWidth - marginLeft - signatureImgWidth 
            : marginLeft;
        pdf.addImage(signatureData, 'PNG', imgX, yPosition - 5, signatureImgWidth, signatureImgHeight);
        yPosition += 12;
      }
    } catch (error) {
      console.warn('Signature could not be loaded:', error);
    }
  }

  pdf.setLineWidth(0.5);
  pdf.line(xPosition, yPosition + 5, xPosition + lineWidth, yPosition + 5);
  
  // Calculate text alignment
  const textAlign = signatureAlign as 'left' | 'center' | 'right';
  let textX = xPosition;
  if (signatureAlign === 'center') textX = pageWidth / 2;
  else if (signatureAlign === 'right') textX = pageWidth - marginLeft;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(settings.director_name, textX, yPosition + 10, { align: textAlign });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${settings.director_title} ${settings.institution_name}`, textX, yPosition + 15, { align: textAlign });

  return yPosition + 20;
};

// Render footer with proper margin respect
const renderFooter = (pdf: jsPDF, block: ContentBlock, data: PreviewData, settings: SystemSettings): void => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const footerY = pageHeight - 12;
  const footerAlign = block.config.footerAlign || 'center';
  
  // Respect page margins - use 15mm on each side
  const marginLeft = 15;
  const marginRight = 15;
  const maxWidth = pageWidth - marginLeft - marginRight;

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);

  const year = new Date().getFullYear();
  
  // Use custom footer text if provided, otherwise use default
  let footerText = block.config.footerText;
  if (footerText) {
    // Replace variables in custom footer text
    footerText = footerText
      .replace(/\{\{institution_name\}\}/g, settings.institution_name || '')
      .replace(/\{\{institution_cnpj\}\}/g, settings.institution_cnpj || '')
      .replace(/\{\{institution_phone\}\}/g, settings.institution_phone || '')
      .replace(/\{\{institution_email\}\}/g, settings.institution_email || '')
      .replace(/\{\{institution_website\}\}/g, settings.institution_website || '')
      .replace(/\{\{pix_holder_name\}\}/g, settings.pix_holder_name || '')
      .replace(/\{\{year\}\}/g, String(year));
  } else {
    footerText = `E-commerce por ${settings.institution_name} © ${year}. ${settings.pix_holder_name || 'JMR Empreendimentos digitais'}/CNPJ: ${settings.institution_cnpj}. Whatsapp: ${settings.institution_phone} ou e-mail: ${settings.institution_email}`;
  }

  // Calculate x position based on alignment
  let xPosition: number;
  let textAlign: 'left' | 'center' | 'right' = 'center';
  if (footerAlign === 'left') {
    xPosition = marginLeft;
    textAlign = 'left';
  } else if (footerAlign === 'right') {
    xPosition = pageWidth - marginRight;
    textAlign = 'right';
  } else {
    xPosition = pageWidth / 2;
    textAlign = 'center';
  }

  // Split text into lines that fit within maxWidth
  const lines = pdf.splitTextToSize(footerText, maxWidth);
  
  lines.forEach((line: string, index: number) => {
    pdf.text(line, xPosition, footerY + (index * 3.5), { align: textAlign });
  });
  
  const websiteY = footerY + (lines.length * 3.5);
  if (settings.institution_website && !block.config.footerText) {
    pdf.text(settings.institution_website, xPosition, websiteY, { align: textAlign });
  }

  pdf.setTextColor(0, 0, 0);
};

// Render modules table with improved styling
const renderModulesTable = (
  pdf: jsPDF,
  data: PreviewData,
  yPosition: number,
  marginLeft: number,
  contentWidth: number,
  block?: ContentBlock
): number => {
  const modules = data.modules || [];
  
  // Table styling from block config or defaults
  const borderColor = block?.config.tableBorderColor || '#000000';
  const headerBgColor = block?.config.tableHeaderBgColor || '#E5E7EB';
  const headerTextColor = block?.config.tableHeaderTextColor || '#000000';
  const alternateColor = block?.config.tableRowAlternateColor || '#FAFAFA';
  const borderWidth = block?.config.tableBorderWidth || 0.3;
  
  // Parse colors
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };
  
  const border = hexToRgb(borderColor);
  const headerBg = hexToRgb(headerBgColor);
  const headerText = hexToRgb(headerTextColor);
  const alternate = hexToRgb(alternateColor);
  
  const moduleColWidth = contentWidth - 50;
  const hoursColWidth = 50;
  const rowHeight = 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setDrawColor(border.r, border.g, border.b);
  pdf.setLineWidth(borderWidth);
  
  // Header row with background
  pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
  pdf.rect(marginLeft, yPosition - 4, moduleColWidth, rowHeight, 'FD');
  pdf.rect(marginLeft + moduleColWidth, yPosition - 4, hoursColWidth, rowHeight, 'FD');
  
  pdf.setTextColor(headerText.r, headerText.g, headerText.b);
  pdf.text('Módulos', marginLeft + 3, yPosition + 1);
  pdf.text('Carga Horária (horas)', marginLeft + moduleColWidth + 3, yPosition + 1);
  
  yPosition += rowHeight - 2;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  let totalHours = 0;
  modules.forEach((module, index) => {
    // Alternate row color
    if (index % 2 === 1) {
      pdf.setFillColor(alternate.r, alternate.g, alternate.b);
      pdf.rect(marginLeft, yPosition - 4, moduleColWidth, rowHeight, 'FD');
      pdf.rect(marginLeft + moduleColWidth, yPosition - 4, hoursColWidth, rowHeight, 'FD');
    } else {
      pdf.rect(marginLeft, yPosition - 4, moduleColWidth, rowHeight);
      pdf.rect(marginLeft + moduleColWidth, yPosition - 4, hoursColWidth, rowHeight);
    }
    
    const moduleName = module.name.length > 60 ? module.name.substring(0, 57) + '...' : module.name;
    pdf.text(moduleName, marginLeft + 3, yPosition + 1);
    pdf.text(`${module.hours}`, marginLeft + moduleColWidth + hoursColWidth / 2, yPosition + 1, { align: 'center' });
    
    totalHours += module.hours;
    yPosition += rowHeight - 2;
  });
  
  // Total row with bold styling
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
  pdf.rect(marginLeft, yPosition - 4, moduleColWidth, rowHeight, 'FD');
  pdf.rect(marginLeft + moduleColWidth, yPosition - 4, hoursColWidth, rowHeight, 'FD');
  pdf.setTextColor(headerText.r, headerText.g, headerText.b);
  pdf.text('TOTAL', marginLeft + 3, yPosition + 1);
  pdf.text(`${data.effective_hours || totalHours}`, marginLeft + moduleColWidth + hoursColWidth / 2, yPosition + 1, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  
  return yPosition + rowHeight + 5;
};

// Render cronograma table with one row per module, centered on page
const renderCronogramaTable = (
  pdf: jsPDF,
  data: PreviewData,
  settings: SystemSettings,
  yPosition: number,
  marginLeft: number,
  block?: ContentBlock
): number => {
  // Table styling from block config or defaults
  const borderColor = block?.config.tableBorderColor || '#000000';
  const headerBgColor = block?.config.tableHeaderBgColor || '#FFFFFF';
  const headerTextColor = block?.config.tableHeaderTextColor || '#000000';
  const borderWidth = block?.config.tableBorderWidth || 0.3;
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };
  
  const border = hexToRgb(borderColor);
  const headerBg = hexToRgb(headerBgColor);
  const headerText = hexToRgb(headerTextColor);
  
  pdf.setDrawColor(border.r, border.g, border.b);
  pdf.setLineWidth(borderWidth);
  
  // Column widths for 5 columns - centered on page
  const colWidths = [40, 28, 28, 55, 35]; // Data, Horário, CH Semanal, Atividade, Local
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const startX = (pageWidth - totalWidth) / 2; // Center the table
  
  const rowHeight = 8;
  const headerHeight = 10;
  
  // Header row
  const headers = ['Data', 'Horário', 'CH Semanal', 'Atividade/Conteúdo', 'Local'];
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
  pdf.setTextColor(headerText.r, headerText.g, headerText.b);
  
  let xPos = startX;
  headers.forEach((header, i) => {
    pdf.rect(xPos, yPosition, colWidths[i], headerHeight, 'FD');
    pdf.text(header, xPos + colWidths[i] / 2, yPosition + headerHeight / 2 + 1, { align: 'center' });
    xPos += colWidths[i];
  });
  
  yPosition += headerHeight;
  
  // Data rows - one per module
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8);
  
  const weeklyHours = data.weekly_hours || 30;
  const institutionName = (settings.institution_name || 'Infomar').split(' ')[0];
  const localText = `Plataforma ${institutionName}`;
  const horarioText = '8:00 às 12:00';
  
  const modules = data.modules || [];
  
  if (modules.length === 0) {
    // If no modules, show a single row with the course name
    xPos = startX;
    const rowData = [
      `${data.start_date} a ${data.end_date}`,
      horarioText,
      weeklyHours.toString(),
      data.course_name || 'Curso',
      localText
    ];
    
    rowData.forEach((text, i) => {
      pdf.rect(xPos, yPosition, colWidths[i], rowHeight);
      const truncated = text.length > 35 ? text.substring(0, 32) + '...' : text;
      pdf.text(truncated, xPos + colWidths[i] / 2, yPosition + rowHeight / 2 + 1, { align: 'center' });
      xPos += colWidths[i];
    });
    
    yPosition += rowHeight;
  } else {
    // Calculate date ranges for each module
    const totalDays = data.start_date && data.end_date ? 
      calculateDaysBetween(data.start_date, data.end_date) : 90;
    const daysPerModule = Math.floor(totalDays / modules.length);
    
    modules.forEach((module, index) => {
      // Calculate date range for this module
      const moduleStartDate = addDaysToDate(data.start_date, index * daysPerModule);
      const moduleEndDate = addDaysToDate(data.start_date, (index + 1) * daysPerModule - 1);
      
      const dateRange = `${moduleStartDate} a ${moduleEndDate}`;
      const moduleName = module.name.length > 35 ? module.name.substring(0, 32) + '...' : module.name;
      
      const rowData = [
        dateRange,
        horarioText,
        weeklyHours.toString(),
        moduleName.toUpperCase(),
        localText
      ];
      
      xPos = startX;
      rowData.forEach((text, i) => {
        pdf.rect(xPos, yPosition, colWidths[i], rowHeight);
        pdf.text(text, xPos + colWidths[i] / 2, yPosition + rowHeight / 2 + 1, { align: 'center' });
        xPos += colWidths[i];
      });
      
      yPosition += rowHeight;
    });
  }
  
  return yPosition + 5;
};

// Helper function to calculate days between two dates
const calculateDaysBetween = (startDateStr: string, endDateStr: string): number => {
  try {
    const parseDate = (str: string) => {
      const parts = str.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return new Date(str);
    };
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 90;
  }
};

// Helper function to add days to a date and return formatted string
const addDaysToDate = (dateStr: string, days: number): string => {
  try {
    const parts = dateStr.split('/');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      date = new Date(dateStr);
    }
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

// Render quote/budget table with pricing info
const renderQuoteTable = (
  pdf: jsPDF,
  data: PreviewData,
  yPosition: number,
  marginLeft: number,
  contentWidth: number,
  block?: ContentBlock
): number => {
  // Table styling from block config or defaults
  const borderColor = block?.config.tableBorderColor || '#000000';
  const headerBgColor = block?.config.tableHeaderBgColor || '#E5E7EB';
  const headerTextColor = block?.config.tableHeaderTextColor || '#000000';
  const borderWidth = block?.config.tableBorderWidth || 0.3;
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };
  
  const border = hexToRgb(borderColor);
  const headerBg = hexToRgb(headerBgColor);
  const headerText = hexToRgb(headerTextColor);
  
  const descColWidth = contentWidth - 40;
  const valueColWidth = 40;
  const rowHeight = 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setDrawColor(border.r, border.g, border.b);
  pdf.setLineWidth(borderWidth);
  
  // Header row
  pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
  pdf.rect(marginLeft, yPosition - 4, descColWidth, rowHeight, 'FD');
  pdf.rect(marginLeft + descColWidth, yPosition - 4, valueColWidth, rowHeight, 'FD');
  
  pdf.setTextColor(headerText.r, headerText.g, headerText.b);
  pdf.text('Módulos', marginLeft + 3, yPosition + 1);
  pdf.text('Valor (Reais)', marginLeft + descColWidth + 3, yPosition + 1);
  
  yPosition += rowHeight - 2;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  // Quote rows based on data
  const quoteRows = [
    { description: `1 curso de licença capacitação – ${data.end_date ? Math.round((new Date(data.end_date.split('/').reverse().join('-')).getTime() - new Date(data.start_date.split('/').reverse().join('-')).getTime()) / (1000 * 60 * 60 * 24)) : 90} dias`, value: data.enrollment_fee || '0,00' },
    { description: 'Taxa de antecipação de documentos (paga)', value: data.pre_enrollment_credit || '0,00' },
    { description: 'Valor restante a pagar', value: data.final_amount || '0,00' }
  ];
  
  quoteRows.forEach((row, index) => {
    pdf.rect(marginLeft, yPosition - 4, descColWidth, rowHeight);
    pdf.rect(marginLeft + descColWidth, yPosition - 4, valueColWidth, rowHeight);
    
    pdf.text(row.description, marginLeft + 3, yPosition + 1);
    pdf.text(row.value, marginLeft + descColWidth + 3, yPosition + 1);
    
    yPosition += rowHeight - 2;
  });
  
  return yPosition + 5;
};

// Render course content (description) block
const renderCourseContent = (
  pdf: jsPDF,
  block: ContentBlock,
  data: PreviewData,
  yPosition: number,
  margins: { left: number; right: number },
  contentWidth: number
): number => {
  const courseContent = data.course_content || '';
  
  if (!courseContent) {
    return yPosition;
  }
  
  // Strip HTML tags and decode entities - FIXED ORDER: decode first, then strip
  const stripHtml = (html: string): string => {
    // 1. FIRST: Decode HTML entities (this must come before tag removal!)
    let decoded = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // 2. Use DOMParser for robust HTML parsing (works in browser context)
    try {
      const doc = new DOMParser().parseFromString(decoded, 'text/html');
      
      // Preserve line breaks from block elements
      doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
      doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(el => {
        el.insertAdjacentText('afterend', '\n\n');
      });
      doc.querySelectorAll('li').forEach(el => {
        el.insertAdjacentText('beforebegin', '• ');
        el.insertAdjacentText('afterend', '\n');
      });
      
      // Extract clean text
      const text = doc.body.textContent || '';
      
      // Clean up excessive whitespace
      return text
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    } catch {
      // Fallback to regex if DOMParser fails
      return decoded
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    }
  };
  
  const plainText = stripHtml(courseContent);
  
  const fontSize = block.config.fontSize || 10;
  const textAlign = block.config.align || 'justify';
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);
  
  // Split text into lines that fit the content width
  const lines = pdf.splitTextToSize(plainText, contentWidth);
  
  const lineHeight = fontSize * 0.4;
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  for (const line of lines) {
    // Check if we need a new page
    if (yPosition > pageHeight - margins.right - 20) {
      pdf.addPage();
      yPosition = 20;
    }
    
    let xPosition = margins.left;
    if (textAlign === 'center') {
      xPosition = pdf.internal.pageSize.getWidth() / 2;
    } else if (textAlign === 'right') {
      xPosition = pdf.internal.pageSize.getWidth() - margins.right;
    }
    
    pdf.text(line, xPosition, yPosition, { 
      align: textAlign === 'justify' ? 'left' : textAlign as any 
    });
    yPosition += lineHeight;
  }
  
  return yPosition + 5;
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
        renderFooter(pdf, footerBlock, data, settings);
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

// Helper function to parse template data from database
const parseTemplateData = (data: any): DocumentTemplate => ({
  ...data,
  content_blocks: typeof data.content_blocks === 'string' 
    ? JSON.parse(data.content_blocks) 
    : data.content_blocks || [],
  margins: typeof data.margins === 'string' 
    ? JSON.parse(data.margins) 
    : data.margins || { top: 20, right: 20, bottom: 20, left: 20 },
  styles: typeof data.styles === 'string' 
    ? JSON.parse(data.styles) 
    : data.styles || {},
});

// Export function to get active template
export const getActiveTemplate = async (type: string): Promise<DocumentTemplate | null> => {
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    const { data, error } = await (supabase as any)
      .from('document_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching default template:', error);
    }

    if (data) {
      return parseTemplateData(data);
    }

    // Try to get any active template if no default found
    const { data: anyTemplate, error: anyError } = await (supabase as any)
      .from('document_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (anyError) {
      console.error('Error fetching any template:', anyError);
      return null;
    }

    if (!anyTemplate) return null;
    
    return parseTemplateData(anyTemplate);
  } catch (error) {
    console.error('Error in getActiveTemplate:', error);
    return null;
  }
};
