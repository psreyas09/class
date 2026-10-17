-- ==============================================================================
-- ClassDesk: Complaint Notification Helper RPCs & Policies
-- ==============================================================================

-- 1. Helper function allowing authenticated students to retrieve CR emails
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

-- 2. Direct read policy on admins table so server and RPCs can reliably fetch CR emails
GRANT SELECT ON public.admins TO authenticated;
DROP POLICY IF EXISTS "Allow authenticated to view admin emails" ON public.admins;
CREATE POLICY "Allow authenticated to view admin emails"
ON public.admins FOR SELECT
TO authenticated
USING (true);

-- 3. Helper function allowing authenticated admins replying to a complaint
--    to retrieve the student's email securely to send an email update.
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

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
