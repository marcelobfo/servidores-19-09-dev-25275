-- Add public access policy for certificate verification
-- This allows anyone to view certificates for verification purposes
CREATE POLICY "Certificates are publicly viewable for verification" 
ON certificates 
FOR SELECT 
TO public
USING (status = 'active');

-- Also add policy for authenticated users to view certificates
CREATE POLICY "Authenticated users can view active certificates" 
ON certificates 
FOR SELECT 
TO authenticated
USING (status = 'active');