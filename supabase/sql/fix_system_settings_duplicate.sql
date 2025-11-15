-- Fix duplicate records in system_settings table
-- This migration ensures only one record exists and prevents future duplicates

-- 1. Identify and keep only the most recent record
WITH ranked_settings AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC NULLS LAST, id) as rn
  FROM system_settings
)
DELETE FROM system_settings
WHERE id IN (
  SELECT id FROM ranked_settings WHERE rn > 1
);

-- 2. Ensure exactly one record exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_settings LIMIT 1) THEN
    INSERT INTO system_settings (
      institution_name,
      institution_address,
      institution_cep,
      institution_cnpj,
      institution_phone,
      institution_email,
      institution_website,
      director_name,
      director_title
    ) VALUES (
      'Infomar Cursos Livres/JMR Empreendimentos digitais',
      'Rua Exemplo, 123',
      '00000-000',
      '00.000.000/0000-00',
      '(00) 0000-0000',
      'contato@infomar.com',
      'https://infomar.com',
      'Nome do Diretor',
      'Diretor Acadêmico'
    );
  END IF;
END $$;

-- 3. Add trigger function to prevent multiple records
CREATE OR REPLACE FUNCTION prevent_multiple_system_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM system_settings) >= 1 AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only one system_settings record is allowed. Use UPDATE instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS ensure_single_system_settings ON system_settings;
CREATE TRIGGER ensure_single_system_settings
  BEFORE INSERT ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_system_settings();

-- 5. Add helpful comment
COMMENT ON TABLE system_settings IS 'Global system configuration (MUST contain exactly 1 row). Use UPDATE to modify settings, never INSERT.';
