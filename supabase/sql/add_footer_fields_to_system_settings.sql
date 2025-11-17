-- Add footer configuration fields to system_settings table
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS footer_description TEXT DEFAULT 'Educação online de qualidade para impulsionar sua carreira e desenvolvimento profissional.',
ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT 'https://facebook.com',
ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT 'https://instagram.com',
ADD COLUMN IF NOT EXISTS social_linkedin TEXT DEFAULT 'https://linkedin.com',
ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT 'contato@infomar.com',
ADD COLUMN IF NOT EXISTS dpo_email TEXT DEFAULT 'dpo@infomar.com',
ADD COLUMN IF NOT EXISTS business_hours TEXT DEFAULT 'Seg-Sex: 9h às 18h';

-- Add helpful comments
COMMENT ON COLUMN system_settings.footer_description IS 'Descrição da instituição exibida no rodapé do site';
COMMENT ON COLUMN system_settings.social_facebook IS 'URL da página do Facebook';
COMMENT ON COLUMN system_settings.social_instagram IS 'URL do perfil do Instagram';
COMMENT ON COLUMN system_settings.social_linkedin IS 'URL da página do LinkedIn';
COMMENT ON COLUMN system_settings.contact_email IS 'Email principal de contato';
COMMENT ON COLUMN system_settings.dpo_email IS 'Email do DPO (Data Protection Officer) para questões de LGPD';
COMMENT ON COLUMN system_settings.business_hours IS 'Horário de atendimento';
