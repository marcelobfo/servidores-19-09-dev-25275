-- Add duration_days column to courses and backfill
BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS duration_days integer;

-- Optional index to speed up filtering by duration
CREATE INDEX IF NOT EXISTS idx_courses_duration_days
  ON public.courses(duration_days);

-- Backfill: set 30 days where null (adjust if needed)
UPDATE public.courses
SET duration_days = 30
WHERE duration_days IS NULL;

COMMIT;