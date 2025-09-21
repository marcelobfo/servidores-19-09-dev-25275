import { supabase } from '@/integrations/supabase/client';
import { generateCertificateWithFullData } from './certificateGenerator';

interface CreateCertificateData {
  enrollmentId: string;
  studentName: string;
  courseName: string;
  courseModules: string;
  completionDate: Date;
  courseHours: number;
}

export const generateCertificateCode = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CERT-${timestamp}-${random}`.toUpperCase();
};

export const createCertificate = async (data: CreateCertificateData) => {
  const certificateCode = generateCertificateCode();
  const verificationUrl = `${window.location.origin}/verify-certificate/${certificateCode}`;
  
  // Generate QR code data
  const qrCodeData = JSON.stringify({
    code: certificateCode,
    url: verificationUrl,
    student: data.studentName,
    course: data.courseName,
    date: data.completionDate.toISOString()
  });

  // Insert certificate record
  const { data: certificate, error: insertError } = await supabase
    .from('certificates')
    .insert({
      enrollment_id: data.enrollmentId,
      student_name: data.studentName,
      course_name: data.courseName,
      completion_date: data.completionDate.toISOString().split('T')[0],
      certificate_code: certificateCode,
      qr_code_data: qrCodeData,
      verification_url: verificationUrl,
      status: 'active'
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create certificate: ${insertError.message}`);
  }

  // Get system settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .single();

  if (!settings) {
    throw new Error('System settings not found');
  }

  // Generate PDF
  const pdfBlob = await generateCertificateWithFullData({
    id: certificate.id,
    studentName: data.studentName,
    courseName: data.courseName,
    courseModules: data.courseModules,
    issueDate: new Date(certificate.issue_date),
    completionDate: data.completionDate,
    certificateCode: certificateCode,
    verificationUrl: verificationUrl,
    courseHours: data.courseHours
  }, settings);

  // Upload PDF to storage
  const fileName = `certificates/${certificateCode}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Failed to upload certificate: ${uploadError.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  // Update certificate with PDF URL
  const { error: updateError } = await supabase
    .from('certificates')
    .update({ verification_url: publicUrl })
    .eq('id', certificate.id);

  if (updateError) {
    console.warn('Failed to update certificate URL:', updateError);
  }

  return certificate;
};

export const getCertificateByCode = async (code: string) => {
  // First get the certificate
  const { data: certificate, error: certError } = await supabase
    .from('certificates')
    .select('*')
    .eq('certificate_code', code)
    .eq('status', 'active')
    .single();

  if (certError || !certificate) {
    throw new Error('Certificate not found or invalid');
  }

  // Then get the enrollment details
  const { data: enrollment } = await supabase
    .from('pre_enrollments')
    .select(`
      full_name,
      courses (
        name,
        duration_hours
      )
    `)
    .eq('id', certificate.enrollment_id)
    .single();

  // Combine the data
  return {
    ...certificate,
    pre_enrollments: enrollment
  };
};

export const generateCertificateForEnrollment = async (enrollmentId: string) => {
  // Get enrollment details
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('pre_enrollments')
    .select(`
      *,
      courses (
        name,
        modules,
        duration_hours,
        end_date
      )
    `)
    .eq('id', enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    throw new Error('Enrollment not found');
  }

  // Check if certificate already exists
  const { data: existingCert } = await supabase
    .from('certificates')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();

  if (existingCert) {
    throw new Error('Certificate already exists for this enrollment');
  }

  // Create certificate
  return await createCertificate({
    enrollmentId,
    studentName: enrollment.full_name,
    courseName: enrollment.courses.name,
    courseModules: enrollment.courses.modules || 'Módulos do curso conforme programa.',
    completionDate: new Date(enrollment.courses.end_date),
    courseHours: enrollment.courses.duration_hours || 390
  });
};