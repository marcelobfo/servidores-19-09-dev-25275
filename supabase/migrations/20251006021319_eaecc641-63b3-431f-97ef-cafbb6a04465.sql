-- Add Gemini API key to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS gemini_api_key text;