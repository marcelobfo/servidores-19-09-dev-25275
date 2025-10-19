-- Adicionar campo para rastrear aprovação manual de matrículas
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS manual_approval BOOLEAN DEFAULT FALSE;

-- Adicionar campo para armazenar o ID do pagamento de matrícula
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS enrollment_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_enrollments_payment_status 
ON public.enrollments(payment_status) 
WHERE payment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_enrollments_status 
ON public.enrollments(status) 
WHERE status = 'pending_payment';

-- Comentários para documentação
COMMENT ON COLUMN public.enrollments.manual_approval IS 
'Indica se a matrícula foi aprovada manualmente pelo admin sem pagamento';

COMMENT ON COLUMN public.enrollments.enrollment_payment_id IS 
'Referência ao pagamento da taxa de matrícula (null se não houver taxa ou se pago por outro meio)';
