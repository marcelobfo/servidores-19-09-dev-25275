-- ============================================
-- VERIFICAÇÃO DE INTEGRIDADE DAS PRÉ-MATRÍCULAS
-- ============================================

-- Verificar pré-matrículas sem dados essenciais
SELECT 
  pe.id,
  pe.full_name,
  pe.email,
  pe.status,
  pe.cpf IS NULL as missing_cpf,
  c.duration_hours IS NULL as missing_duration,
  c.modules IS NULL as missing_modules
FROM pre_enrollments pe
JOIN courses c ON pe.course_id = c.id
WHERE pe.cpf IS NULL 
   OR c.duration_hours IS NULL 
   OR c.modules IS NULL
ORDER BY pe.created_at DESC;

-- Verificar pagamentos órfãos
SELECT 
  p.id,
  p.pre_enrollment_id,
  p.enrollment_id,
  p.kind,
  p.status,
  p.amount
FROM payments p
WHERE p.kind = 'pre_enrollment'
  AND (p.pre_enrollment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM pre_enrollments pe WHERE pe.id = p.pre_enrollment_id
  ))
ORDER BY p.created_at DESC;

-- Verificar inconsistências de status
SELECT 
  pe.id,
  pe.full_name,
  pe.status as pre_enrollment_status,
  p.status as payment_status,
  p.kind as payment_kind
FROM pre_enrollments pe
LEFT JOIN payments p ON p.pre_enrollment_id = pe.id
WHERE (pe.status = 'payment_confirmed' AND p.status IN ('pending', 'waiting'))
   OR (pe.status = 'pending' AND p.status IN ('confirmed', 'received'))
ORDER BY pe.created_at DESC;
