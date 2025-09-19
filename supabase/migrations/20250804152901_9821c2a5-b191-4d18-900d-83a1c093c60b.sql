-- Add missing columns to pre_enrollments table
ALTER TABLE public.pre_enrollments 
ADD COLUMN license_duration text,
ADD COLUMN license_start_date date,
ADD COLUMN license_end_date date,
ADD COLUMN whatsapp text;

-- Add payment enabled/disabled setting to payment_settings
ALTER TABLE public.payment_settings 
ADD COLUMN enabled boolean DEFAULT true;

-- Update payment_settings to have better defaults
UPDATE public.payment_settings 
SET enabled = true 
WHERE enabled IS NULL;