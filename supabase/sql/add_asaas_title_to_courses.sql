-- Add asaas_title column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS asaas_title text;

-- Add comment to explain the column
COMMENT ON COLUMN public.courses.asaas_title IS 'Título usado internamente na API Asaas (sem caracteres especiais)';
