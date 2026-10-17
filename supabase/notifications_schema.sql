-- ==============================================================================
-- ClassDesk: Push Notifications Subscriptions Table & RLS Policies
-- Enables browser and mobile web push notifications for classroom tasks
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

-- 1. Students can register and manage their own device push subscriptions
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

-- 2. Admins and CRs can read subscriptions to broadcast task notifications
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
