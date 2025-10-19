-- ============================================
-- CORREÇÃO DE PRÉ-MATRÍCULAS EXISTENTES
-- ============================================

-- 1. Adicionar status 'pending_payment' se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'enrollment_status' 
        AND e.enumlabel = 'pending_payment'
    ) THEN
        ALTER TYPE enrollment_status ADD VALUE 'pending_payment';
    END IF;
END $$;

-- 2. Atualizar pré-matrículas que têm pagamentos pendentes para status 'pending_payment'
UPDATE pre_enrollments pe
SET status = 'pending_payment'
WHERE pe.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.pre_enrollment_id = pe.id
      AND p.status IN ('pending', 'waiting')
      AND p.kind IN ('pre_enrollment', 'enrollment')
  );

-- 3. Atualizar pré-matrículas que têm pagamentos confirmados para 'payment_confirmed'
UPDATE pre_enrollments pe
SET status = 'payment_confirmed'
WHERE pe.status IN ('pending', 'pending_payment')
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.pre_enrollment_id = pe.id
      AND p.status IN ('confirmed', 'received')
      AND p.kind IN ('pre_enrollment', 'enrollment')
  );

-- 4. Corrigir o 'kind' dos pagamentos de pré-matrícula
UPDATE payments
SET kind = 'pre_enrollment'
WHERE kind = 'enrollment'
  AND pre_enrollment_id IS NOT NULL
  AND enrollment_id IS NULL;

-- 5. Verificar e reportar inconsistências (não altera dados, apenas para análise)
SELECT 
  'PRE_ENROLLMENTS SEM PAGAMENTO' as tipo,
  COUNT(*) as quantidade
FROM pre_enrollments pe
WHERE pe.status IN ('pending_payment', 'payment_confirmed')
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.pre_enrollment_id = pe.id
  )
UNION ALL
SELECT 
  'PAGAMENTOS SEM PRE_ENROLLMENT' as tipo,
  COUNT(*) as quantidade
FROM payments p
WHERE p.kind = 'pre_enrollment'
  AND p.pre_enrollment_id IS NULL
UNION ALL
SELECT 
  'PRE_ENROLLMENTS PENDING COM PAGAMENTO CONFIRMADO' as tipo,
  COUNT(*) as quantidade
FROM pre_enrollments pe
WHERE pe.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.pre_enrollment_id = pe.id
      AND p.status IN ('confirmed', 'received')
  );
