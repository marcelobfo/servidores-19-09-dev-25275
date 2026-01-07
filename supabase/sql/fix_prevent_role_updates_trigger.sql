-- ============================================
-- FIX: TRIGGER prevent_role_updates()
-- ============================================
-- Este script corrige o trigger que bloqueia mudanças de role em profiles
-- para permitir operações no SQL Editor/migrations (onde auth.uid() é NULL)
-- ============================================

-- 1. Recriar a função prevent_role_updates() com bypass para auth.uid() NULL
CREATE OR REPLACE FUNCTION public.prevent_role_updates()
RETURNS trigger AS $$
BEGIN
  -- Se não há contexto de auth (ex.: SQL Editor / migrations), não bloquear
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só bloquear mudança de role para usuários autenticados que não são admin
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::user_role) THEN
      RAISE EXCEPTION 'Only administrators can modify user roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Confirmar que a função foi criada/atualizada
SELECT 
  proname as function_name,
  prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'prevent_role_updates';

-- ============================================
-- INSTRUÇÕES DE USO
-- ============================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. Depois, promova usuários usando INSERT em user_roles:
--    INSERT INTO public.user_roles (user_id, role)
--    VALUES ('UUID_DO_USUARIO', 'admin'::user_role)
--    ON CONFLICT (user_id, role) DO NOTHING;
-- 3. NÃO use UPDATE em profiles.role para promover admins
-- ============================================
