-- Add certificate_notified column to enrollments table
BEGIN;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS certificate_notified boolean DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_enrollments_certificate_notified
  ON public.enrollments(certificate_notified, status, enrollment_date);

-- Add pre_enrollment_id if it doesn't exist
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS pre_enrollment_id uuid REFERENCES public.pre_enrollments(id) ON DELETE SET NULL;

-- Add index for pre_enrollment_id
CREATE INDEX IF NOT EXISTS idx_enrollments_pre_enrollment_id
  ON public.enrollments(pre_enrollment_id);

COMMIT;