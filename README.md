# ClassDesk 🎓

A utilitarian, high-density web application designed for a college classroom of students and two Class Representatives (CRs). Built to track active deadlines and class inquiries with zero paid services and zero scheduled cron jobs.

Deployed on **Vercel** + **Supabase** (Free Tier).

---

## ⚡ Features

1. **Tasks Board (Assignments, Records, Forms)**:
   - Active work sorted by nearest due date.
   - Clear countdown badges (`due in 2 days`, `due today`, `overdue by 1 day`).
   - **4-Day Auto-Removal Rule**: Tasks remain visible for 4 days after their deadline, then automatically vanish from the student view (`due_at + interval '4 days' > now()`). Overdue tasks show a vanish warning notice.
   - Filter by subject, type (*Assignment*, *Record*, *Reference Record*, *Form*, *Other*), and search.
   - External submission links open securely with `rel="noopener noreferrer"`.
2. **Prominent Resources Link**:
   - One-click access to the official class Google Drive in the header and home page.
   - Drive URL is stored in the `settings` database table and editable by CRs from `/admin` without redeploying.
3. **Complaints & Queries**:
   - Any registered student can submit a query or grievance across *Infrastructure*, *Academic*, *Timetable*, or *Other*.
   - **Anonymous Privacy**: Students can submit anonymously. RLS policies and `admin_complaints_view` guarantee that student identity (`student_id`, `name`, `email`) is completely masked to `NULL` for Admins.
   - CRs can reply and update status (*Open*, *In Progress*, *Fixed*, *Cannot Be Fixed*).
   - Mandatory explanation required when marking an issue as *Cannot Be Fixed*.
   - **Public Resolved View** (`/resolved`): Class-wide transparency log showing handled issues without student identities or raw descriptions.
4. **CR Admin Dashboard** (`/admin`):
   - **Tasks**: Create, edit, and delete tasks with Asia/Kolkata date pickers.
   - **Archive**: View expired or manually archived tasks with one-click **Restore** (+3 days extension) or permanent delete.
   - **Complaints Inbox**: Filter by status and category, reply and resolve complaints.
   - **Student Approvals**: Review registered students and approve access.
   - **Drive Link**: Instant update of the Google Drive URL.
5. **Utilitarian Design**:
   - No flashy AI gradients or heavy glassmorphism.
   - Single font pair: **Inter** (UI) + **JetBrains Mono** (dates, timestamps, countdowns).
   - Warm off-white (`#FBFBF9`) and near-black (`#0F0F10`) theme with a single warm amber accent.
   - Mobile-first bottom navigation for one-thumb phone usage.

---

## 🛠 Tech Stack

- **Framework**: Next.js (App Router, TypeScript, dynamic SSR)
- **Styling**: Tailwind CSS, `next-themes` (Dark/Light mode)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security)
- **Icons**: `lucide-react`
- **Timezone**: Stored in UTC, parsed & formatted strictly in `Asia/Kolkata`

---

## 🚀 Setup & Installation

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd class
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_NAME=ClassDesk
```

> ⚠️ **Security Warning**: Never use the `service-role` key in frontend code or in any `NEXT_PUBLIC_` variable.

---

## 🗄️ Database Setup (Supabase)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** in the left sidebar.
3. Paste the complete SQL migration below and click **Run**:

```sql
-- 1. ADMINS TABLE
CREATE TABLE public.admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;

-- Seed your two Class Representative emails:
INSERT INTO public.admins (email) VALUES
  (lower('cr1@college.edu')),
  (lower('cr2@college.edu'))
ON CONFLICT (email) DO NOTHING;

-- Admin role helper
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
  );
END;
$$;

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_approved BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_cr BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.admins
    WHERE email = lower(NEW.email)
  ) INTO v_is_cr;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_is_cr
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    is_approved = CASE WHEN v_is_cr THEN TRUE ELSE public.profiles.is_approved END,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
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
CREATE POLICY "Users can only read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can only update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- 3. SETTINGS TABLE
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  CONSTRAINT check_drive_url CHECK (key <> 'resources_drive_url' OR value LIKE 'https://%')
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (key, value) VALUES ('resources_drive_url', 'https://drive.google.com') ON CONFLICT (key) DO NOTHING;
CREATE POLICY "Settings viewable by approved users or admins" ON public.settings FOR SELECT TO authenticated USING (public.is_approved() OR public.is_admin());
CREATE POLICY "Admins can update settings" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. TASKS TABLE
CREATE TYPE public.task_type AS ENUM ('Assignment', 'Record', 'Reference Record', 'Form', 'Other');
CREATE TABLE public.tasks (
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
CREATE INDEX idx_tasks_due_at ON public.tasks(due_at);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved students can view active tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_admin() OR (public.is_approved() AND is_archived = false AND due_at + interval '4 days' > now()));
CREATE POLICY "Admins have full access to tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. COMPLAINTS & REPLIES
CREATE TYPE public.complaint_category AS ENUM ('Infrastructure', 'Academic', 'Timetable', 'Other');
CREATE TYPE public.complaint_status AS ENUM ('Open', 'In Progress', 'Fixed', 'Cannot Be Fixed');

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 120),
  category public.complaint_category NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can only read own complaints" ON public.complaints FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Approved students can insert own complaints as Open" ON public.complaints FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() AND status = 'Open' AND (public.is_approved() OR public.is_admin()));

CREATE TABLE public.complaint_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_name TEXT NOT NULL,
  reply_text TEXT NOT NULL CHECK (char_length(reply_text) <= 2000),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.complaint_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Replies viewable by admin or complaint owner" ON public.complaint_replies FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_replies.complaint_id AND c.student_id = auth.uid()));

-- 6. VIEWS (SECURITY BARRIER)
CREATE OR REPLACE VIEW public.admin_complaints_view WITH (security_barrier = true) AS
SELECT
  c.id, c.title, c.category, c.description, c.is_anonymous, c.status, c.created_at, c.updated_at,
  CASE WHEN c.is_anonymous THEN NULL ELSE c.student_id END AS student_id,
  CASE WHEN c.is_anonymous THEN 'Anonymous Student' ELSE p.full_name END AS student_name,
  CASE WHEN c.is_anonymous THEN NULL ELSE p.email END AS student_email
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
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(p_user_id UUID, p_approved BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: only admins can approve users' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles SET is_approved = p_approved, updated_at = timezone('utc'::text, now()) WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile % not found', p_user_id USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_approval(UUID, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, BOOLEAN) TO authenticated;

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
```

---

## 👥 Adding the Two Class Admins (CRs)

In your Supabase SQL Editor, run:
```sql
INSERT INTO public.admins (email) VALUES
  (lower('cr1_email@college.edu')),
  (lower('cr2_email@college.edu'))
ON CONFLICT (email) DO NOTHING;
```

When either CR registers or signs in with that email address:
- Their account is automatically assigned the `is_approved = true` status.
- They immediately receive access to the `/admin` control dashboard.
- Admin permissions are enforced directly by PostgreSQL RLS.

---

## 🚢 Deploying to Vercel

1. Push your repository to **GitHub** (or GitLab/Bitbucket).
2. Go to [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import your `class` repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase `anon` / public key
   - `NEXT_PUBLIC_APP_NAME`: Your chosen app name (e.g. `ClassDesk`)
5. Click **Deploy**.

Vercel will compile the Next.js App Router application with zero paid requirements. All features (tasks, auto-removal, Drive link, complaints, and RLS) will be live immediately!
