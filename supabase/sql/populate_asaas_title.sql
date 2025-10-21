-- Popular todos os cursos com asaas_title = "Licenca Capacitacao"
-- Este título é usado na API Asaas (limitado a 30 caracteres, sem acentos)
UPDATE public.courses
SET asaas_title = 'Licenca Capacitacao'
WHERE asaas_title IS NULL OR asaas_title = '';

-- Verificar quantos cursos foram atualizados
SELECT 
  COUNT(*) as total_courses,
  COUNT(CASE WHEN asaas_title = 'Licenca Capacitacao' THEN 1 END) as with_asaas_title
FROM public.courses;
