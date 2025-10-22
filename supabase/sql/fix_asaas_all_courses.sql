-- ============================================
-- FIX ASAAS TITLE - CORREÇÃO DEFINITIVA
-- ============================================
-- Este script garante que TODOS os cursos tenham 
-- asaas_title = 'Licenca Capacitacao' (20 caracteres)
-- conforme exigido pela API Asaas (max 30 caracteres)
-- ============================================

-- 1. Atualizar todos os cursos existentes
UPDATE public.courses
SET asaas_title = 'Licenca Capacitacao'
WHERE asaas_title IS NULL 
   OR asaas_title != 'Licenca Capacitacao'
   OR LENGTH(asaas_title) > 30;

-- 2. Verificar o resultado
SELECT 
  id,
  name,
  asaas_title,
  LENGTH(asaas_title) as title_length,
  CASE 
    WHEN asaas_title = 'Licenca Capacitacao' THEN '✅ OK'
    WHEN asaas_title IS NULL THEN '❌ NULL'
    WHEN LENGTH(asaas_title) > 30 THEN '❌ MUITO LONGO (' || LENGTH(asaas_title) || ' chars)'
    ELSE '⚠️ Diferente: ' || asaas_title
  END as status
FROM public.courses
ORDER BY created_at DESC
LIMIT 20;

-- 3. Estatísticas finais
SELECT 
  COUNT(*) as total_cursos,
  COUNT(CASE WHEN asaas_title = 'Licenca Capacitacao' THEN 1 END) as cursos_corretos,
  COUNT(CASE WHEN asaas_title IS NULL OR asaas_title != 'Licenca Capacitacao' THEN 1 END) as cursos_incorretos,
  COUNT(CASE WHEN LENGTH(asaas_title) > 30 THEN 1 END) as cursos_excedendo_limite
FROM public.courses;

-- 4. Mensagem de confirmação
DO $$
DECLARE
  cursos_atualizados INTEGER;
BEGIN
  SELECT COUNT(*) INTO cursos_atualizados 
  FROM public.courses 
  WHERE asaas_title = 'Licenca Capacitacao';
  
  RAISE NOTICE '✅ CORREÇÃO CONCLUÍDA!';
  RAISE NOTICE '📊 Total de cursos com asaas_title correto: %', cursos_atualizados;
  RAISE NOTICE '🎯 Todos os cursos agora usam "Licenca Capacitacao" (20 caracteres)';
  RAISE NOTICE '✅ Limite Asaas de 30 caracteres: RESPEITADO';
END $$;
