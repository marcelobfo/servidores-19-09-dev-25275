-- Create certificates table
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.pre_enrollments(id),
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_date DATE NOT NULL,
  certificate_code TEXT NOT NULL UNIQUE,
  qr_code_data TEXT NOT NULL,
  verification_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage certificates" 
ON public.certificates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Students can view their own certificates" 
ON public.certificates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM pre_enrollments 
    WHERE pre_enrollments.id = certificates.enrollment_id 
    AND pre_enrollments.user_id = auth.uid()
  )
);

-- Create index for certificate code lookups
CREATE INDEX idx_certificates_code ON public.certificates(certificate_code);
CREATE INDEX idx_certificates_enrollment ON public.certificates(enrollment_id);

-- Add trigger for updated_at
CREATE TRIGGER update_certificates_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();