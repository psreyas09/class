-- ==============================================================================
-- ClassDesk: Complete All-in-One Database Schema & Setup
-- Includes:
--   1. Admins & Roles (Primary Admin: psreyas09@gmail.com, CRs)
--   2. Profiles & Universal Instant Sign-in for Students
--   3. Class Settings (Dynamic Google Drive Resources URL)
--   4. Task Management & Deadlines (Asia/Kolkata, 4-Day Window)
--   5. Complaints System (Display Name vs Anonymous Confidentiality)
--   6. CR Replies & Public Resolved Log
--   7. RLS Security & Server RPCs
-- ==============================================================================

-- 1. ADMINS TABLE & PRIMARY ADMIN
CREATE TABLE IF NOT EXISTS public.admins (
  email TEXT PRIMARY KEY,
  role TEXT DEFAULT 'cr' CHECK (role IN ('primary', 'cr')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;

-- Seed Primary Admin
INSERT INTO public.admins (email, role)
VALUES (lower('psreyas09@gmail.com'), 'primary')
ON CONFLICT (email) DO UPDATE SET role = 'primary';

-- Admin role helper (recognizes all admins + hardcoded fallback for primary)
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

-- Primary admin helper
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

-- 2. PROFILES TABLE & UNIVERSAL INSTANT SIGN-IN
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_approved BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger: auto-approves all newly registered users immediately
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
    TRUE -- Immediate access for all enrolled students
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_approved = true
  );
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only read own profile" ON public.profiles;
CREATE POLICY "Users can only read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users can only update own profile" ON public.profiles;
CREATE POLICY "Users can only update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- 3. SETTINGS TABLE (Google Drive URL)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  CONSTRAINT check_drive_url CHECK (key <> 'resources_drive_url' OR value LIKE 'https://%')
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (key, value) VALUES ('resources_drive_url', 'https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
DROP POLICY IF EXISTS "Settings viewable by approved users or admins" ON public.settings;
CREATE POLICY "Settings viewable by approved users or admins" ON public.settings FOR SELECT TO authenticated USING (public.is_approved() OR public.is_admin());
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
CREATE POLICY "Admins can update settings" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. TASKS TABLE
DO $$ BEGIN
  CREATE TYPE public.task_type AS ENUM ('Assignment', 'Record', 'Reference Record', 'Form', 'Other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) <= 150),
  type public.task_type NOT NULL DEFAULT 'Assignment',
  subject TEXT NOT NULL CHECK (char_length(subject) <= 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  due_at TIMESTAMPTZ NOT NULL,
  link TEXT CHECK (link IS NULL OR link LIKE 'http://%' OR link LIKE 'https://%'),
  is_archived BOOLEAN DEFAULT FALSE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approved students can view active tasks" ON public.tasks;
CREATE POLICY "Approved students can view active tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_admin() OR (public.is_approved() AND is_archived = false AND due_at + interval '4 days' > now()));
DROP POLICY IF EXISTS "Admins have full access to tasks" ON public.tasks;
CREATE POLICY "Admins have full access to tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. COMPLAINTS & REPLIES TABLE
DO $$ BEGIN
  CREATE TYPE public.complaint_category AS ENUM ('Infrastructure', 'Academic', 'Timetable', 'Other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('Open', 'In Progress', 'Fixed', 'Cannot Be Fixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 120),
  category public.complaint_category NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 100),
  is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only read own complaints" ON public.complaints;
DROP POLICY IF EXISTS "All authenticated users can view complaints" ON public.complaints;
CREATE POLICY "All authenticated users can view complaints" ON public.complaints FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Approved students can insert own complaints as Open" ON public.complaints;
CREATE POLICY "Approved students can insert own complaints as Open" ON public.complaints FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() AND status = 'Open' AND (public.is_approved() OR public.is_admin()));

CREATE TABLE IF NOT EXISTS public.complaint_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_name TEXT NOT NULL,
  reply_text TEXT NOT NULL CHECK (char_length(reply_text) <= 2000),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.complaint_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Replies viewable by admin or complaint owner" ON public.complaint_replies;
DROP POLICY IF EXISTS "Replies viewable by all authenticated users" ON public.complaint_replies;
CREATE POLICY "Replies viewable by all authenticated users" ON public.complaint_replies FOR SELECT TO authenticated USING (true);

-- 6. VIEWS (SECURITY BARRIER)
DROP VIEW IF EXISTS public.admin_complaints_view;
CREATE VIEW public.admin_complaints_view WITH (security_barrier = true) AS
SELECT
  c.id, c.title, c.category, c.description, c.is_anonymous, c.status, c.created_at, c.updated_at,
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

CREATE OR REPLACE VIEW public.resolved_complaints_view WITH (security_barrier = true) AS
SELECT
  c.id, c.title, c.category, c.status, c.updated_at,
  (SELECT cr.reply_text FROM public.complaint_replies cr WHERE cr.complaint_id = c.id ORDER BY cr.created_at DESC LIMIT 1) AS latest_reply
FROM public.complaints c
WHERE c.status IN ('Fixed', 'Cannot Be Fixed') AND (public.is_approved() OR public.is_admin());

REVOKE ALL ON public.admin_complaints_view FROM anon, authenticated, public;
GRANT SELECT ON public.admin_complaints_view TO authenticated;
REVOKE ALL ON public.resolved_complaints_view FROM anon, authenticated, public;
GRANT SELECT ON public.resolved_complaints_view TO authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- 7. RPC FUNCTIONS

-- Moderator approval RPC
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(p_user_id UUID, p_approved BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: only admins can manage user approvals' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles SET is_approved = p_approved, updated_at = timezone('utc'::text, now()) WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile % not found', p_user_id USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_approval(UUID, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, BOOLEAN) TO authenticated;

-- Reply to complaint RPC
CREATE OR REPLACE FUNCTION public.admin_reply_to_complaint(p_complaint_id UUID, p_reply TEXT, p_status public.complaint_status)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_name TEXT;
  v_trimmed_reply TEXT := btrim(coalesce(p_reply, ''));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: only admins can reply to complaints' USING ERRCODE = '42501'; END IF;
  IF p_status = 'Cannot Be Fixed' AND v_trimmed_reply = '' THEN RAISE EXCEPTION 'A reason is required when marking a complaint as Cannot Be Fixed' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(full_name, split_part(email, '@', 1), 'Class Admin') INTO v_admin_name FROM public.profiles WHERE id = auth.uid();
  IF v_admin_name IS NULL THEN v_admin_name := 'Class Admin'; END IF;
  IF v_trimmed_reply <> '' THEN
    INSERT INTO public.complaint_replies (complaint_id, admin_id, admin_name, reply_text)
    VALUES (p_complaint_id, auth.uid(), v_admin_name, v_trimmed_reply);
  END IF;
  UPDATE public.complaints SET status = p_status, updated_at = timezone('utc'::text, now()) WHERE id = p_complaint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint % not found', p_complaint_id USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reply_to_complaint(UUID, TEXT, public.complaint_status) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_reply_to_complaint(UUID, TEXT, public.complaint_status) TO authenticated;

-- CR Management RPC: Get CR list (Admins only)
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

-- CR Management RPC: Add Class Representative (Primary Admin only)
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

  UPDATE public.profiles
  SET is_approved = TRUE, updated_at = timezone('utc'::text, now())
  WHERE email = v_clean_email;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_cr(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_add_cr(TEXT) TO authenticated;

-- CR Management RPC: Remove Class Representative (Primary Admin only)
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
-- 9. PUSH NOTIFICATIONS SUBSCRIPTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can read all push subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete expired push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can delete expired push subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (public.is_admin());

GRANT ALL ON public.push_subscriptions TO authenticated;

-- ==============================================================================
-- 10. COMPLAINT NOTIFICATION HELPERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_cr_notification_emails()
RETURNS TABLE (email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT a.email
  FROM public.admins a
  WHERE a.email IS NOT NULL AND a.email LIKE '%@%';
END;
$$;

REVOKE ALL ON FUNCTION public.get_cr_notification_emails() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_cr_notification_emails() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_complaint_notification_info(p_complaint_id UUID)
RETURNS TABLE (
  student_email TEXT,
  student_name TEXT,
  complaint_title TEXT,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.email AS student_email,
    COALESCE(NULLIF(trim(c.display_name), ''), p.full_name, split_part(p.email, '@', 1), 'Student') AS student_name,
    c.title AS complaint_title,
    c.category::TEXT AS category
  FROM public.complaints c
  JOIN public.profiles p ON p.id = c.student_id
  WHERE c.id = p_complaint_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_complaint_notification_info(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_complaint_notification_info(UUID) TO authenticated;

