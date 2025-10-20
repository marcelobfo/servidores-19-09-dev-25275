-- Add subtitle column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS subtitle text;

-- Add comment to explain the column
COMMENT ON COLUMN public.courses.subtitle IS 'Subtítulo ou texto complementar do curso';
