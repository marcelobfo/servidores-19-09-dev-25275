-- Add configurable Asaas API base URLs to payment_settings
-- This allows administrators to configure the exact API endpoints used

ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS asaas_base_url_sandbox TEXT DEFAULT 'https://api-sandbox.asaas.com/v3',
ADD COLUMN IF NOT EXISTS asaas_base_url_production TEXT DEFAULT 'https://api.asaas.com/v3';

-- Add comment for documentation
COMMENT ON COLUMN payment_settings.asaas_base_url_sandbox IS 'Base URL for Asaas sandbox API (default: https://api-sandbox.asaas.com/v3)';
COMMENT ON COLUMN payment_settings.asaas_base_url_production IS 'Base URL for Asaas production API (default: https://api.asaas.com/v3)';
