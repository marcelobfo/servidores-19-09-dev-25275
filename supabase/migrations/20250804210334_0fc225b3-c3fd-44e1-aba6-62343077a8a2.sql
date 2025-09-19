-- Add webhook fields to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN n8n_webhook_url text,
ADD COLUMN webhook_events text[] DEFAULT ARRAY['enrollment_created', 'payment_confirmed', 'enrollment_approved', 'status_changed'];

-- Create webhook_logs table to track webhook attempts
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_url text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  enrollment_id uuid REFERENCES public.pre_enrollments(id)
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook_logs
CREATE POLICY "Admins can manage webhook logs" 
ON public.webhook_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add index for better performance
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_enrollment_id ON public.webhook_logs(enrollment_id);