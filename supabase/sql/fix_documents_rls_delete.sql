-- Allow authenticated users to delete their own documents (for regeneration)

-- Enrollment Declarations DELETE policy
DROP POLICY IF EXISTS "Users can delete own enrollment declarations" ON public.enrollment_declarations;
CREATE POLICY "Users can delete own enrollment declarations" ON public.enrollment_declarations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pre_enrollments
    WHERE pre_enrollments.id = enrollment_declarations.pre_enrollment_id
      AND pre_enrollments.user_id = auth.uid()
  )
);

-- Study Plans DELETE policy
DROP POLICY IF EXISTS "Users can delete own study plans" ON public.study_plans;
CREATE POLICY "Users can delete own study plans" ON public.study_plans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pre_enrollments
    WHERE pre_enrollments.id = study_plans.pre_enrollment_id
      AND pre_enrollments.user_id = auth.uid()
  )
);

-- Grant DELETE permission
GRANT DELETE ON public.enrollment_declarations TO authenticated;
GRANT DELETE ON public.study_plans TO authenticated;
