-- Adicionar coluna para valor com desconto pré-calculado
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS discounted_enrollment_fee numeric;

-- Comentário explicativo
COMMENT ON COLUMN public.courses.discounted_enrollment_fee IS 
  'Valor da matrícula com desconto pré-calculado (enrollment_fee - pre_enrollment_fee). Mínimo R$ 5,00.';

-- Pré-popular todos os cursos existentes com o cálculo
UPDATE public.courses
SET discounted_enrollment_fee = GREATEST(
  COALESCE(enrollment_fee, 0) - COALESCE(pre_enrollment_fee, 0),
  5  -- Mínimo R$ 5,00 (exigência Asaas)
)
WHERE enrollment_fee IS NOT NULL AND pre_enrollment_fee IS NOT NULL;

-- Para cursos onde só tem enrollment_fee, usar o valor cheio
UPDATE public.courses
SET discounted_enrollment_fee = enrollment_fee
WHERE enrollment_fee IS NOT NULL 
  AND (pre_enrollment_fee IS NULL OR pre_enrollment_fee = 0)
  AND discounted_enrollment_fee IS NULL;
