-- Adicionar coluna weekly_hours (carga horária semanal) à tabela organ_types
-- Servidores federais = 20h/semana
-- Outros = 30h/semana

ALTER TABLE organ_types 
ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 30 NOT NULL;

-- Atualizar valores padrão baseado no tipo de órgão:
-- Órgãos federais = 20h/semana
UPDATE organ_types 
SET weekly_hours = 20 
WHERE is_federal = true;

-- Outros órgãos = 30h/semana
UPDATE organ_types 
SET weekly_hours = 30 
WHERE is_federal = false;
