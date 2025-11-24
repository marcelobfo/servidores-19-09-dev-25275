-- ============================================
-- ADICIONAR SUPER ADMIN: marcelo@technedigital.com.br
-- ============================================
-- Este script adiciona marcelo@technedigital.com.br como super admin
-- IMPORTANTE: O usuário precisa ter se cadastrado no sistema antes
-- ============================================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Buscar o user_id do Marcelo
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'marcelo@technedigital.com.br'
  LIMIT 1;

  -- Se o usuário existir, adicionar role de admin
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE '✅ Admin role adicionado com sucesso para marcelo@technedigital.com.br';
    RAISE NOTICE '📧 User ID: %', v_user_id;
  ELSE
    RAISE NOTICE '⚠️ ATENÇÃO: Usuário marcelo@technedigital.com.br não encontrado!';
    RAISE NOTICE '📝 O usuário precisa criar uma conta em /auth antes de receber permissões de admin.';
  END IF;
END $$;

-- Verificar o resultado
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  ur.role,
  ur.created_at as role_created_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'marcelo@technedigital.com.br';

-- Estatísticas de usuários admin
SELECT 
  COUNT(DISTINCT ur.user_id) as total_admins,
  array_agg(u.email) as admin_emails
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin';
