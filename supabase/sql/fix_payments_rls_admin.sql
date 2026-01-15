-- ============================================
-- FIX: RLS POLICIES PARA payments
-- ============================================
-- Este script corrige as policies de RLS na tabela payments
-- para permitir que admins possam inserir pagamentos manuais
-- e alunos possam visualizar seus próprios pagamentos
-- ============================================

-- 1. Remover policies antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.payments;

-- 2. Criar policy para usuários verem seus próprios pagamentos
-- (baseado no pre_enrollment_id vinculado ao user_id)
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_enrollments
    WHERE pre_enrollments.id = payments.pre_enrollment_id
      AND pre_enrollments.user_id = auth.uid()
  )
);

-- 3. Criar policy para admins verem TODOS os pagamentos
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. Criar policy para admins inserirem pagamentos (manuais)
CREATE POLICY "Admins can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 5. Criar policy para admins atualizarem pagamentos
CREATE POLICY "Admins can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 6. Criar policy para admins deletarem pagamentos
CREATE POLICY "Admins can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'payments';
