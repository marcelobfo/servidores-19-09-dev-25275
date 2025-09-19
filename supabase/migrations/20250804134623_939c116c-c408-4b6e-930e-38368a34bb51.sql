-- Criar tabela para configurações de pagamento
CREATE TABLE public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pricing_type TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'per_course')),
  fixed_price DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  asaas_api_key TEXT,
  asaas_webhook_token TEXT,
  payment_description TEXT DEFAULT 'Taxa de matrícula - Licença Capacitação',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar preço por curso na tabela courses
ALTER TABLE public.courses 
ADD COLUMN price DECIMAL(10,2);

-- Criar tabela para transações de pagamento
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pre_enrollment_id UUID NOT NULL REFERENCES public.pre_enrollments(id) ON DELETE CASCADE,
  asaas_payment_id TEXT UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'confirmed', 'overdue', 'refunded')),
  pix_qr_code TEXT,
  pix_payload TEXT,
  pix_expiration_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Atualizar enum de status de pre_enrollments para incluir novos estados
ALTER TYPE enrollment_status ADD VALUE 'pending_payment';
ALTER TYPE enrollment_status ADD VALUE 'payment_confirmed';

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para payment_settings
CREATE POLICY "Admins can manage payment settings" 
ON public.payment_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Payment settings are viewable by everyone" 
ON public.payment_settings 
FOR SELECT 
USING (true);

-- Políticas RLS para payments
CREATE POLICY "Admins can manage payments" 
ON public.payments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their own payments" 
ON public.payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM pre_enrollments 
  WHERE pre_enrollments.id = payments.pre_enrollment_id 
  AND pre_enrollments.user_id = auth.uid()
));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão de pagamento
INSERT INTO public.payment_settings (pricing_type, fixed_price, payment_description) 
VALUES ('fixed', 150.00, 'Taxa de matrícula - Licença Capacitação');