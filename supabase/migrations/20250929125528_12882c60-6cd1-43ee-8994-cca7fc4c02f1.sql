-- Add trigger to automatically generate documents when pre-enrollment is approved
CREATE OR REPLACE FUNCTION public.auto_generate_documents()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Call the edge function to generate documents
    PERFORM
      net.http_post(
        url := 'https://lavqzqqfsdtduwphzehr.supabase.co/functions/v1/generate-enrollment-documents',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
        body := ('{"preEnrollmentId": "' || NEW.id || '"}')::jsonb
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on pre_enrollments table
DROP TRIGGER IF EXISTS auto_generate_documents_trigger ON pre_enrollments;
CREATE TRIGGER auto_generate_documents_trigger
  AFTER UPDATE ON pre_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_documents();

-- Add pdf_url column to certificates table to separate from verification_url
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS pdf_url text;