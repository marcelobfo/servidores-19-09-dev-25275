-- Add environment fields to payment_settings table
ALTER TABLE payment_settings 
ADD COLUMN environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('production', 'sandbox'));

ALTER TABLE payment_settings 
ADD COLUMN asaas_api_key_sandbox TEXT,
ADD COLUMN asaas_api_key_production TEXT;

-- Update existing data to use sandbox environment by default
UPDATE payment_settings 
SET environment = 'sandbox', 
    asaas_api_key_sandbox = asaas_api_key 
WHERE asaas_api_key IS NOT NULL;