-- ==============================================================================
-- ClassDesk: Announcements Schema & Notification Tracking
-- Enables CRs to broadcast announcements with email & browser push notifications
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'important', 'urgent'
  link TEXT,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_email TEXT,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' or 'selected'
  target_user_ids TEXT[],
  target_count INTEGER NOT NULL DEFAULT 0,
  channels TEXT[] NOT NULL DEFAULT ARRAY['mail', 'browser'],
  emails_sent INTEGER NOT NULL DEFAULT 0,
  push_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for chronological listing
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 1. Admins / CRs can perform all operations (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Authenticated users can view announcements targeted to all or specifically to them
DROP POLICY IF EXISTS "Students can view relevant announcements" ON public.announcements;
CREATE POLICY "Students can view relevant announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (
  target_type = 'all' OR
  auth.uid()::text = ANY(target_user_ids) OR
  public.is_admin()
);

-- Allow authenticated role to access
GRANT ALL ON public.announcements TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
