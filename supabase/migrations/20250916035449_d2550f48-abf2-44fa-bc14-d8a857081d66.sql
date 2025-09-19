-- Add address fields to pre_enrollments table
ALTER TABLE public.pre_enrollments 
ADD COLUMN postal_code TEXT,
ADD COLUMN address_number TEXT,
ADD COLUMN complement TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT;