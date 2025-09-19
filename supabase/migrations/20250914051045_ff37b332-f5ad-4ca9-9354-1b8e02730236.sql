-- Update the ADMINISTRAÇÃO PÚBLICA 6.0 course to have an enrollment fee
UPDATE courses 
SET enrollment_fee = 150.00
WHERE name = 'ADMINISTRAÇÃO PÚBLICA 6.0' AND enrollment_fee IS NULL;