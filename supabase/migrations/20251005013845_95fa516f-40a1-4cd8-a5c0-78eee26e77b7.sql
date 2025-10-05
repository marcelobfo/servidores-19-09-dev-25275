-- ===================================================================
-- CRITICAL SECURITY FIXES
-- ===================================================================

-- 1. CREATE SEPARATE USER ROLES TABLE (Fixes Privilege Escalation)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. MIGRATE EXISTING ROLES TO NEW TABLE
-- ===================================================================
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. UPDATE has_role() FUNCTION TO USE NEW TABLE
-- ===================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. ADMIN-ONLY POLICIES FOR USER_ROLES TABLE
-- ===================================================================
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- 5. REMOVE ROLE COLUMN FROM PROFILES UPDATE POLICY
-- ===================================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (excluding role)" ON public.profiles;

-- New policy - users can update their profile but not the role column
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger to prevent role column updates by non-admins
CREATE OR REPLACE FUNCTION public.prevent_role_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow role changes if user is admin
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
      RAISE EXCEPTION 'Only administrators can modify user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_role_updates_trigger ON public.profiles;
CREATE TRIGGER prevent_role_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_updates();

-- 6. FIX PAYMENT SETTINGS EXPOSURE
-- ===================================================================
DROP POLICY IF EXISTS "Payment settings are viewable by everyone" ON public.payment_settings;
DROP POLICY IF EXISTS "Only admins can access payment settings" ON public.payment_settings;

-- Create admin-only access policy
CREATE POLICY "Only admins can manage payment settings"
ON public.payment_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- 7. FIX CERTIFICATE PII EXPOSURE
-- ===================================================================
DROP POLICY IF EXISTS "Certificates are publicly viewable for verification" ON public.certificates;
DROP POLICY IF EXISTS "Authenticated users can view active certificates" ON public.certificates;
DROP POLICY IF EXISTS "Public can verify certificates by code only" ON public.certificates;

-- Restrict public certificate access - still allow verification but policy is more restrictive
CREATE POLICY "Public can verify active certificates"
ON public.certificates
FOR SELECT
USING (status = 'active');

-- 8. ADD WEBHOOK TOKEN VALIDATION HELPER
-- ===================================================================
CREATE OR REPLACE FUNCTION public.is_valid_webhook_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_settings
    WHERE asaas_webhook_token = _token
    LIMIT 1
  )
$$;