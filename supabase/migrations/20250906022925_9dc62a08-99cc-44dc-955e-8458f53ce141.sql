-- Primeiro, vamos garantir que todos os cursos tenham valores válidos para pre_enrollment_fee
-- Cursos sem pre_enrollment_fee definido receberão um valor padrão de R$ 57,00

UPDATE public.courses 
SET pre_enrollment_fee = 57.00 
WHERE pre_enrollment_fee IS NULL OR pre_enrollment_fee = 0;

-- Cursos sem enrollment_fee definido receberão um valor baseado no price ou um padrão
UPDATE public.courses 
SET enrollment_fee = COALESCE(price, 497.00)
WHERE enrollment_fee IS NULL OR enrollment_fee = 0;

-- Adicionar campos para melhor controle de aprovação de órgão na tabela pre_enrollments
ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS organ_approval_status TEXT DEFAULT 'pending' CHECK (organ_approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS organ_approval_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS organ_approval_notes TEXT;

-- Atualizar registros existentes baseado no organ_approval_confirmed
UPDATE public.pre_enrollments 
SET organ_approval_status = CASE 
    WHEN organ_approval_confirmed = true THEN 'approved'
    ELSE 'pending'
END
WHERE organ_approval_status = 'pending';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pre_enrollments_organ_approval 
ON public.pre_enrollments(organ_approval_status, status);

CREATE INDEX IF NOT EXISTS idx_pre_enrollments_user_status 
ON public.pre_enrollments(user_id, status);

-- Adicionar campos para rastrear pagamento de matrícula na tabela enrollments
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS enrollment_payment_id UUID REFERENCES public.payments(id);

ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS enrollment_amount NUMERIC(10,2);

ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMP WITH TIME ZONE;