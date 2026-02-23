-- Fix: Allow all authenticated users to READ document templates
-- Students need to read default templates to generate their PDFs
-- Admin-only restriction should only apply to INSERT/UPDATE/DELETE

-- Drop the admin-only SELECT policy
DROP POLICY IF EXISTS "Admins can view templates" ON document_templates;

-- Create a new SELECT policy for all authenticated users
CREATE POLICY "Authenticated users can view templates" ON document_templates
  FOR SELECT
  TO authenticated
  USING (true);
