-- Corrigir política RLS de payment_settings para usar app_role correto
DROP POLICY IF EXISTS "Only admins can manage payment settings" ON public.payment_settings;
DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.payment_settings;

-- Criar política correta usando app_role
CREATE POLICY "Admins can manage payment settings"
ON public.payment_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Verificar que a política foi criada
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'payment_settings';
