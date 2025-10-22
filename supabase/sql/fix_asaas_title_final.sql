-- Garantir que TODOS os cursos tenham asaas_title = 'Licenca Capacitacao'
-- Este script corrige qualquer curso com valor diferente ou NULL

UPDATE public.courses
SET asaas_title = 'Licenca Capacitacao'
WHERE asaas_title IS NULL OR asaas_title != 'Licenca Capacitacao';

-- Verificar o resultado
SELECT 
  id,
  name,
  asaas_title,
  CASE 
    WHEN asaas_title = 'Licenca Capacitacao' THEN '✅ OK'
    WHEN asaas_title IS NULL THEN '❌ NULL'
    ELSE '⚠️ Diferente: ' || asaas_title
  END as status
FROM public.courses
ORDER BY created_at DESC;

-- Contar cursos corrigidos
SELECT 
  COUNT(*) as total_courses,
  COUNT(CASE WHEN asaas_title = 'Licenca Capacitacao' THEN 1 END) as courses_with_correct_title,
  COUNT(CASE WHEN asaas_title IS NULL OR asaas_title != 'Licenca Capacitacao' THEN 1 END) as courses_needing_fix
FROM public.courses;
