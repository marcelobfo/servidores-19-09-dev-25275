-- Ensure primary super admin has admin role in user_roles
-- This fixes 403 RLS errors for admin-only tables (e.g., webhook_logs) and
-- allows admin actions that depend on public.is_admin(auth.uid()).

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.user_role
FROM auth.users u
WHERE lower(u.email) = lower('marcelo@technedigital.com.br')
ON CONFLICT (user_id, role) DO NOTHING;
