-- Add institution_id to courses table
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- Add index for faster joins
CREATE INDEX IF NOT EXISTS idx_courses_institution_id ON public.courses(institution_id);

-- Add comment
COMMENT ON COLUMN public.courses.institution_id IS 'Reference to the institution that defines the workload calculation rules for this course';

-- Update duration_days constraint to include 75 days option
ALTER TABLE public.courses
DROP CONSTRAINT IF EXISTS courses_duration_days_check;

ALTER TABLE public.courses
ADD CONSTRAINT courses_duration_days_check 
CHECK (duration_days IN (15, 30, 45, 60, 75, 90));

COMMENT ON COLUMN public.courses.duration_days IS 'Course duration in days. Valid options: 15, 30, 45, 60, 75, 90';
