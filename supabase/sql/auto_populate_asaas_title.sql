-- Criar função que automaticamente preenche asaas_title
CREATE OR REPLACE FUNCTION auto_populate_asaas_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Se asaas_title estiver vazio ou nulo, preencher com valor padrão
  IF NEW.asaas_title IS NULL OR NEW.asaas_title = '' THEN
    NEW.asaas_title := 'Licenca Capacitacao';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trigger_auto_populate_asaas_title ON public.courses;

-- Criar trigger que executa antes de INSERT ou UPDATE
CREATE TRIGGER trigger_auto_populate_asaas_title
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_asaas_title();

-- Popular cursos existentes que ainda não têm asaas_title
UPDATE public.courses
SET asaas_title = 'Licenca Capacitacao'
WHERE asaas_title IS NULL OR asaas_title = '';

-- Verificar resultado
SELECT 
  id,
  name,
  asaas_title,
  CASE 
    WHEN asaas_title IS NOT NULL AND asaas_title != '' THEN '✅ OK'
    ELSE '❌ Vazio'
  END as status
FROM public.courses
ORDER BY created_at DESC;
