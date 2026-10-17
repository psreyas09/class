-- ==============================================================================
-- ClassDesk Migration: Primary Admin (psreyas09@gmail.com), Dynamic CR Management,
-- Universal Instant Sign-in, and Display Name / Anonymous Complaints Support
-- ==============================================================================

-- 1. ADMINS TABLE & PRIMARY ADMIN
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cr' CHECK (role IN ('primary', 'cr'));

-- Insert/Promote psreyas09@gmail.com as Primary Admin
INSERT INTO public.admins (email, role)
VALUES (lower('psreyas09@gmail.com'), 'primary')
ON CONFLICT (email) DO UPDATE SET role = 'primary';

-- Updated is_admin function (checks public.admins or hardcoded fallback for psreyas09@gmail.com)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'psreyas09@gmail.com';
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Helper to check if current user is the Primary Admin
CREATE OR REPLACE FUNCTION public.is_primary_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND (role = 'primary' OR email = 'psreyas09@gmail.com')
  ) OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'psreyas09@gmail.com';
END;
$$;

REVOKE ALL ON FUNCTION public.is_primary_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_primary_admin() TO authenticated;

-- RPC: Get CR list (Callable by Admins)
CREATE OR REPLACE FUNCTION public.admin_get_cr_list()
RETURNS TABLE (
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only admins can view the CR list' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.email, a.role, a.created_at
  FROM public.admins a
  ORDER BY CASE WHEN a.role = 'primary' THEN 0 ELSE 1 END, a.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cr_list() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_get_cr_list() TO authenticated;

-- RPC: Add Class Representative (Only Primary Admin can execute)
CREATE OR REPLACE FUNCTION public.admin_add_cr(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_email TEXT;
BEGIN
  IF NOT public.is_primary_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only the Primary Admin (psreyas09@gmail.com) can add Class Representatives' USING ERRCODE = '42501';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Please provide a valid email address';
  END IF;

  INSERT INTO public.admins (email, role)
  VALUES (v_clean_email, 'cr')
  ON CONFLICT (email) DO UPDATE SET role = 'cr';

  -- Auto-approve in profiles if user already registered
  UPDATE public.profiles
  SET is_approved = TRUE, updated_at = timezone('utc'::text, now())
  WHERE email = v_clean_email;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_cr(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_add_cr(TEXT) TO authenticated;

-- RPC: Remove Class Representative (Only Primary Admin can execute, cannot remove primary)
CREATE OR REPLACE FUNCTION public.admin_remove_cr(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_email TEXT;
BEGIN
  IF NOT public.is_primary_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only the Primary Admin (psreyas09@gmail.com) can remove Class Representatives' USING ERRCODE = '42501';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email = 'psreyas09@gmail.com' THEN
    RAISE EXCEPTION 'Cannot remove the Primary Admin account';
  END IF;

  DELETE FROM public.admins
  WHERE email = v_clean_email AND role <> 'primary';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_cr(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_remove_cr(TEXT) TO authenticated;

-- ==============================================================================
-- 2. UNIVERSAL INSTANT SIGN-IN FOR ALL STUDENTS
-- ==============================================================================

-- Make is_approved default to TRUE
ALTER TABLE public.profiles ALTER COLUMN is_approved SET DEFAULT TRUE;

-- Update existing profiles to approved
UPDATE public.profiles SET is_approved = TRUE;

-- Update handle_new_user trigger so all newly registered students can sign in immediately
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    TRUE -- Auto-approve so all students can immediately sign in and access tasks
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. COMPLAINTS: DISPLAY NAME & ANONYMOUS SUPPORT
-- ==============================================================================

-- Add display_name column to complaints table
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 100);

-- Update admin_complaints_view to respect display_name when not anonymous
DROP VIEW IF EXISTS public.admin_complaints_view;
CREATE VIEW public.admin_complaints_view WITH (security_barrier = true) AS
SELECT
  c.id,
  c.title,
  c.category,
  c.description,
  c.is_anonymous,
  c.status,
  c.created_at,
  c.updated_at,
  CASE WHEN c.is_anonymous THEN NULL ELSE c.student_id END AS student_id,
  CASE 
    WHEN c.is_anonymous THEN 'Anonymous Student' 
    ELSE COALESCE(NULLIF(trim(c.display_name), ''), p.full_name, split_part(p.email, '@', 1), 'Student') 
  END AS student_name,
  CASE WHEN c.is_anonymous THEN NULL ELSE p.email END AS student_email,
  c.display_name
FROM public.complaints c
LEFT JOIN public.profiles p ON c.student_id = p.id
WHERE public.is_admin();

REVOKE ALL ON public.admin_complaints_view FROM anon, authenticated, public;
GRANT SELECT ON public.admin_complaints_view TO authenticated;
