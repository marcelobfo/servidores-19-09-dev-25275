-- Add checkout_url column to payments table
-- This column stores the Asaas checkout URL for card/boleto payments

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS checkout_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN payments.checkout_url IS 'URL do checkout Asaas para pagamentos via Cartão/Boleto';
