-- Fix RLS policies for admin to see all pre-enrollments
-- This ensures admins can view and manage all pre-enrollments

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own pre-enrollments" ON public.pre_enrollments;
DROP POLICY IF EXISTS "Admins can view all pre-enrollments" ON public.pre_enrollments;
DROP POLICY IF EXISTS "Users can insert their own pre-enrollments" ON public.pre_enrollments;
DROP POLICY IF EXISTS "Users can update their own pre-enrollments" ON public.pre_enrollments;
DROP POLICY IF EXISTS "Admins can update all pre-enrollments" ON public.pre_enrollments;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Create comprehensive RLS policies for pre_enrollments

-- SELECT: Users can see their own pre-enrollments OR admins can see all
CREATE POLICY "Users and admins can view pre-enrollments" ON public.pre_enrollments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

-- INSERT: Users can insert their own pre-enrollments
CREATE POLICY "Users can insert their own pre-enrollments" ON public.pre_enrollments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own pre-enrollments OR admins can update all
CREATE POLICY "Users and admins can update pre-enrollments" ON public.pre_enrollments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.is_admin(auth.uid())
)
WITH CHECK (
  user_id = auth.uid() OR public.is_admin(auth.uid())
);

-- DELETE: Only admins can delete pre-enrollments
CREATE POLICY "Admins can delete pre-enrollments" ON public.pre_enrollments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add manual_approval flag to track admin-forced approvals
ALTER TABLE public.pre_enrollments 
ADD COLUMN IF NOT EXISTS manual_approval boolean DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.pre_enrollments.manual_approval IS 'Indicates if the enrollment was manually approved by admin (bypassing payment validation)';
