-- Add discount checkout webhook URL field to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS discount_checkout_webhook_url text;

-- Comment for documentation
COMMENT ON COLUMN public.system_settings.discount_checkout_webhook_url IS 'URL do webhook N8N para gerar checkout com desconto';
