-- Fix RLS policies for enrollment_declarations and study_plans
-- This ensures users can view their documents and admins can view all

-- Enable RLS on both tables
ALTER TABLE public.enrollment_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users and admins can view enrollment declarations" ON public.enrollment_declarations;
DROP POLICY IF EXISTS "System can insert enrollment declarations" ON public.enrollment_declarations;
DROP POLICY IF EXISTS "Users and admins can view study plans" ON public.study_plans;
DROP POLICY IF EXISTS "System can insert study plans" ON public.study_plans;

-- Enrollment Declarations Policies

-- SELECT: Users can see their own declarations OR admins can see all
CREATE POLICY "Users and admins can view enrollment declarations" ON public.enrollment_declarations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pre_enrollments
    WHERE pre_enrollments.id = enrollment_declarations.pre_enrollment_id
      AND (pre_enrollments.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

-- INSERT: Service role can insert (from edge functions)
CREATE POLICY "System can insert enrollment declarations" ON public.enrollment_declarations
FOR INSERT
TO service_role
WITH CHECK (true);

-- Study Plans Policies

-- SELECT: Users can see their own study plans OR admins can see all
CREATE POLICY "Users and admins can view study plans" ON public.study_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pre_enrollments
    WHERE pre_enrollments.id = study_plans.pre_enrollment_id
      AND (pre_enrollments.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

-- INSERT: Service role can insert (from edge functions)
CREATE POLICY "System can insert study plans" ON public.study_plans
FOR INSERT
TO service_role
WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT ON public.enrollment_declarations TO authenticated;
GRANT SELECT ON public.study_plans TO authenticated;
GRANT ALL ON public.enrollment_declarations TO service_role;
GRANT ALL ON public.study_plans TO service_role;
