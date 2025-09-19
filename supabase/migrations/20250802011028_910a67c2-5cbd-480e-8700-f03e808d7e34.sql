-- Add missing fields to pre_enrollments table
ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT;

-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT,
  director_signature_url TEXT,
  institution_name TEXT DEFAULT 'Infomar Cursos Livres/JMR Empreendimentos digitais',
  institution_address TEXT DEFAULT 'Av. Paulista, 1636 CJ 4 – São Paulo - SP',
  institution_cep TEXT DEFAULT '01310-200',
  institution_cnpj TEXT DEFAULT '41.651.963/0001-32',
  institution_phone TEXT DEFAULT '(61) 99296-8232',
  institution_email TEXT DEFAULT 'infomarcursos@infomarcursos.com.br',
  institution_website TEXT DEFAULT 'https://www.infomarcursos.com.br/',
  director_name TEXT DEFAULT 'José Victor Furtado J. F de Oliveira',
  director_title TEXT DEFAULT 'Diretor Acadêmico Infomar Cursos Livres',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for system_settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "System settings are viewable by everyone" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Add trigger for timestamps
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Add duration and start/end dates to courses
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 390,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add fields for document URLs to pre_enrollments
ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS study_plan_url TEXT,
ADD COLUMN IF NOT EXISTS enrollment_declaration_url TEXT;