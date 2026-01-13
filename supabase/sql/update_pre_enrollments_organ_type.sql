-- ============================================
-- ATUALIZAÇÃO DE PRÉ-MATRÍCULAS EXISTENTES
-- ============================================
-- Este script atribui o tipo de órgão "Normal" 
-- para todas as pré-matrículas que não possuem
-- organ_type_id definido.

-- 1. Primeiro, buscar o ID do tipo "Normal"
-- 2. Atualizar todas as pré-matrículas sem organ_type_id

DO $$
DECLARE
  normal_organ_type_id UUID;
  updated_count INTEGER;
BEGIN
  -- Buscar o ID do tipo de órgão "Normal"
  SELECT id INTO normal_organ_type_id
  FROM organ_types
  WHERE name = 'Normal'
  LIMIT 1;
  
  -- Verificar se encontrou
  IF normal_organ_type_id IS NULL THEN
    RAISE EXCEPTION 'Tipo de órgão "Normal" não encontrado. Execute primeiro o script create_organ_types.sql';
  END IF;
  
  -- Atualizar pré-matrículas sem organ_type_id
  UPDATE pre_enrollments
  SET organ_type_id = normal_organ_type_id
  WHERE organ_type_id IS NULL;
  
  -- Obter contagem de registros atualizados
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Reportar resultado
  RAISE NOTICE 'Atualizadas % pré-matrículas com organ_type_id = Normal', updated_count;
END $$;

-- 3. Verificar resultado - distribuição por tipo de órgão
SELECT 
  'Pré-matrículas por tipo de órgão' as descricao,
  COALESCE(ot.name, 'SEM TIPO') as tipo_orgao,
  COUNT(*) as quantidade
FROM pre_enrollments pe
LEFT JOIN organ_types ot ON pe.organ_type_id = ot.id
GROUP BY ot.name
ORDER BY quantidade DESC;
