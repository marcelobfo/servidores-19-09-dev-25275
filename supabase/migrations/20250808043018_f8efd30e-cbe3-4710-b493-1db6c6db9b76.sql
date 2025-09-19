-- Create enrollments table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_enrollment_id uuid NOT NULL UNIQUE REFERENCES public.pre_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'awaiting_payment',
  payment_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage enrollments"
ON public.enrollments
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their enrollments"
ON public.enrollments
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their enrollments"
ON public.enrollments
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their enrollments"
ON public.enrollments
FOR UPDATE
USING (user_id = auth.uid());

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enrollments_set_updated_at'
  ) THEN
    CREATE TRIGGER enrollments_set_updated_at
    BEFORE UPDATE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Alter payments: add kind, enrollment_id, error_message
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'pre_enrollment',
  ADD COLUMN IF NOT EXISTS enrollment_id uuid NULL REFERENCES public.enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_message text NULL;

-- Optional constraint for kind values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_kind_check'
  ) THEN
    ALTER TABLE public.payments
    ADD CONSTRAINT payments_kind_check CHECK (kind IN ('pre_enrollment','enrollment'));
  END IF;
END$$;

-- Alter courses: add fees
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS pre_enrollment_fee numeric NULL,
  ADD COLUMN IF NOT EXISTS enrollment_fee numeric NULL;

-- Backfill enrollment_fee from existing price if present
UPDATE public.courses
SET enrollment_fee = COALESCE(enrollment_fee, price)
WHERE price IS NOT NULL;

-- Backfill pre_enrollment_fee from payment_settings.fixed_price (latest row) if present
UPDATE public.courses c
SET pre_enrollment_fee = COALESCE(pre_enrollment_fee, ps.fixed_price)
FROM (
  SELECT fixed_price
  FROM public.payment_settings
  ORDER BY created_at DESC
  LIMIT 1
) ps
WHERE c.pre_enrollment_fee IS NULL AND ps.fixed_price IS NOT NULL;

-- Add certificate backgrounds and seal to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS certificate_front_bg_url text NULL,
  ADD COLUMN IF NOT EXISTS certificate_back_bg_url text NULL,
  ADD COLUMN IF NOT EXISTS abed_seal_url text NULL;
