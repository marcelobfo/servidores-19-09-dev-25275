-- Add gemini_api_key column to system_settings table
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Create default system_settings record if it doesn't exist
INSERT INTO system_settings (
  id,
  institution_name,
  institution_address,
  institution_cep,
  institution_cnpj,
  institution_phone,
  institution_email,
  institution_website,
  director_name,
  director_title,
  logo_url,
  director_signature_url
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sua Instituição',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Add helpful comment
COMMENT ON COLUMN system_settings.gemini_api_key IS 'Google AI Studio API Key for Gemini image generation (modelo: gemini-2.5-flash-image-preview)';
