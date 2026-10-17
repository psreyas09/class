-- ==============================================================================
-- ClassDesk: Class-wide Complaints Visibility & Absolute Anonymity
-- 1. All authenticated students can view all complaints and CR replies
-- 2. Anonymous complaints are 100% anonymous to ALL (students, CRs, and admins)
-- ==============================================================================

-- 1. Update RLS on public.complaints: allow all authenticated users to view
DROP POLICY IF EXISTS "Students can only read own complaints" ON public.complaints;
DROP POLICY IF EXISTS "All authenticated users can view complaints" ON public.complaints;

CREATE POLICY "All authenticated users can view complaints"
ON public.complaints FOR SELECT
TO authenticated
USING (true);

-- 2. Update RLS on public.complaint_replies: allow all authenticated users to view replies
DROP POLICY IF EXISTS "Replies viewable by admin or complaint owner" ON public.complaint_replies;
DROP POLICY IF EXISTS "Replies viewable by all authenticated users" ON public.complaint_replies;

CREATE POLICY "Replies viewable by all authenticated users"
ON public.complaint_replies FOR SELECT
TO authenticated
USING (true);

-- 3. Ensure admin_complaints_view strictly masks identity for anonymous complaints
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
