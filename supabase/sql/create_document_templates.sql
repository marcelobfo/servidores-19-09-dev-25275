-- Create document_templates table for customizable PDF templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('declaration', 'study_plan', 'quote', 'certificate')),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  page_orientation VARCHAR(20) DEFAULT 'portrait' CHECK (page_orientation IN ('portrait', 'landscape')),
  page_format VARCHAR(10) DEFAULT 'a4' CHECK (page_format IN ('a4', 'letter')),
  margins JSONB DEFAULT '{"top": 20, "right": 20, "bottom": 20, "left": 20}',
  content_blocks JSONB NOT NULL DEFAULT '[]',
  styles JSONB DEFAULT '{"primaryColor": "#1E40AF", "fontFamily": "helvetica"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view templates
CREATE POLICY "Admins can view templates" ON document_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policy: Admins can insert templates
CREATE POLICY "Admins can insert templates" ON document_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policy: Admins can update templates
CREATE POLICY "Admins can update templates" ON document_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policy: Admins can delete templates
CREATE POLICY "Admins can delete templates" ON document_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Ensure only one default per type
CREATE UNIQUE INDEX idx_document_templates_default_per_type 
  ON document_templates (type) 
  WHERE is_default = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_document_templates_updated_at();
