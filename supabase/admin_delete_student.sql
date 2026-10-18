-- Migration: Add admin_delete_user function to permanently remove students
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- 1. Ensure caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only admins can delete users' USING ERRCODE = '42501';
  END IF;

  -- 2. Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own admin account from here' USING ERRCODE = '42501';
  END IF;

  -- 3. Prevent deleting admins or CRs
  SELECT email INTO v_user_email FROM public.profiles WHERE id = p_user_id;
  IF v_user_email IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.admins WHERE lower(email) = lower(v_user_email)) THEN
      RAISE EXCEPTION 'Cannot delete a Class Representative or Admin. Remove their admin role first.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4. Clean up any loose references (like created_by / updated_by)
  UPDATE public.tasks SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.settings SET updated_by = NULL WHERE updated_by = p_user_id;

  -- 5. Delete complaints belonging to the student
  DELETE FROM public.complaints WHERE student_id = p_user_id;

  -- 6. Delete from auth.users (cascades to public.profiles and public.push_subscriptions)
  DELETE FROM auth.users WHERE id = p_user_id;

  -- 7. Ensure profile is deleted even if auth.users record was not linked
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- Allow admins to delete profiles directly as fallback
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());
GRANT DELETE ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
