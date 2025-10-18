-- Create institutions table with workload rules
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'federal',
  workload_rules JSONB NOT NULL DEFAULT '{"15": 65, "30": 130, "45": 195, "60": 260, "75": 325, "90": 390}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.institutions IS 'Stores institutions/organizations with their specific workload calculation rules';
COMMENT ON COLUMN public.institutions.workload_rules IS 'JSON object with duration_days as keys and workload_hours as values. Example: {"15": 65, "30": 130, "45": 195, "60": 260, "75": 325, "90": 390}';

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_institutions_name ON public.institutions(name);
CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON public.institutions(is_active);

-- Enable RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active institutions
CREATE POLICY "Anyone can view active institutions"
ON public.institutions
FOR SELECT
USING (is_active = true);

-- Policy: Only admins can insert institutions
CREATE POLICY "Only admins can insert institutions"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Policy: Only admins can update institutions
CREATE POLICY "Only admins can update institutions"
ON public.institutions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Policy: Only admins can delete institutions
CREATE POLICY "Only admins can delete institutions"
ON public.institutions
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_institutions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_institutions_updated_at();
