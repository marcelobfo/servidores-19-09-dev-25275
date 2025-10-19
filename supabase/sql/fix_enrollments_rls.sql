-- Fix RLS policies for enrollments table to allow admin access

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users and admins can view enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can insert their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;

-- Enable RLS on enrollments table
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see their own enrollments OR admins can see all
CREATE POLICY "Users and admins can view enrollments"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

-- INSERT: Users can insert their own enrollments
CREATE POLICY "Users can insert their own enrollments"
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Admins can update all enrollments, users can update their own
CREATE POLICY "Users and admins can update enrollments"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

-- DELETE: Only admins can delete enrollments
CREATE POLICY "Admins can delete enrollments"
ON public.enrollments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'enrollments';
