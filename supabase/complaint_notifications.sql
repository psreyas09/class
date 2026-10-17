-- ==============================================================================
-- ClassDesk: Complaint Notification Helper RPCs
-- 1. get_cr_notification_emails: allows authenticated students submitting a complaint
--    to retrieve CR emails for dispatch without exposing the full admins table.
-- 2. get_complaint_notification_info: allows authenticated admins replying to a complaint
--    to retrieve the student's email securely to send an email update.
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
