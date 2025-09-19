-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Create storage policies for document uploads (logos and signatures)
CREATE POLICY "Public access to documents" ON storage.objects
FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload documents" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update documents" ON storage.objects
FOR UPDATE USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete documents" ON storage.objects
FOR DELETE USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::user_role));