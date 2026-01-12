-- Criar tabela organ_types (Tipos de Órgãos)
-- Permite definir multiplicadores de carga horária para órgãos federais

CREATE TABLE IF NOT EXISTS organ_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hours_multiplier DECIMAL(3,2) DEFAULT 1.0 NOT NULL,
  is_federal BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Inserir tipos padrão
INSERT INTO organ_types (name, hours_multiplier, is_federal) VALUES
  ('Normal', 1.0, false),
  ('Câmara dos Deputados Federal', 0.5, true),
  ('Senado Federal', 0.5, true),
  ('Outros Órgãos Federais', 0.5, true)
ON CONFLICT (name) DO NOTHING;

-- Adicionar colunas em pre_enrollments
ALTER TABLE pre_enrollments 
ADD COLUMN IF NOT EXISTS organ_type_id UUID REFERENCES organ_types(id),
ADD COLUMN IF NOT EXISTS custom_hours INTEGER;

-- Habilitar RLS
ALTER TABLE organ_types ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para organ_types
-- Todos podem ler (público)
CREATE POLICY "Anyone can view organ types"
ON organ_types FOR SELECT
USING (true);

-- Apenas admins podem inserir
CREATE POLICY "Admins can insert organ types"
ON organ_types FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Apenas admins podem atualizar
CREATE POLICY "Admins can update organ types"
ON organ_types FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Apenas admins podem deletar
CREATE POLICY "Admins can delete organ types"
ON organ_types FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);
