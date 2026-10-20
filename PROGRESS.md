# Project Progress & Handoff Snapshot

- **Project**: ClassDesk (College Classroom Web Application)
- **Deployment Target**: Vercel + Supabase (Free Tier)
- **Current Branch**: `main` (clean, in sync with `origin/main`)
- **Status**: Production-ready, verified (`npm run build` cleanly passed)

---

## 📌 Recent Features & Changelog

### 1. CR Announcement Broadcast System (Email & Browser Web Push)
- **Description**: CRs can now type and broadcast announcements directly from CR Admin Control to all registered students or custom selected students via both Email and Native Browser Web Push notifications.
- **Backend**:
  - API endpoint [`src/app/api/announcements/broadcast/route.ts`](src/app/api/announcements/broadcast/route.ts) with full Admin/CR verification, audience filtering, parallel email delivery (Gmail SMTP / Resend), Web Push dispatch, and database persistence.
  - Database schema and RLS policies in [`supabase/announcements_schema.sql`](supabase/announcements_schema.sql).
- **Frontend**:
  - Announcements tab in CR Admin Control with composer and history ([`src/components/admin/announcement-broadcast-section.tsx`](src/components/admin/announcement-broadcast-section.tsx)).
  - Audience selection modes: "All Students" or "Select Users" with live search and multi-select.
  - Priority levels (`Normal`, `Important`, `Urgent`), attachment URL, and delivery channel toggles.
  - Live announcement notice card on the student homepage ([`src/components/task-board.tsx`](src/components/task-board.tsx)).

### 2. Permanent Student Account Removal (Admin Dashboard)
- **Commit**: `9019263`
- **Description**: Admins / CRs previously could only toggle "Revoke Access" (soft suspend). An explicit **Remove Student** action (Trash icon) has been added to the **Student Approvals** tab.
- **Backend / Database**:
  - `admin_delete_user(p_user_id UUID)` RPC in [`supabase/admin_delete_student.sql`](supabase/admin_delete_student.sql) and [`supabase/full_schema.sql`](supabase/full_schema.sql).
  - Deletes from `auth.users`, automatically cascading to `public.profiles`, `public.complaints`, and `public.push_subscriptions`.
  - Cleans up any foreign key references (`tasks.created_by`, `settings.updated_by`).
  - **Guards**: Prevents admins from deleting themselves and prevents deleting users with active CR/Admin roles.
  - Added fallback direct delete RLS policy on `public.profiles` for admins.
- **Frontend**:
  - Updated [`src/components/admin/admin-dashboard.tsx`](src/components/admin/admin-dashboard.tsx) with confirmation modal and optimistic list updating.

### 2. New Task Types: `Exam` & `Registration`
- **Commit**: `e687980`
- **Description**: Added `"Exam"` and `"Registration"` task categories alongside Assignment, Record, Reference Record, Form, and Other.
- **Database**:
  - Migration script [`supabase/add_task_types_exam_registration.sql`](supabase/add_task_types_exam_registration.sql).
  - Added values to `public.task_type` enum via `ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS ...`.
- **Frontend**:
  - Updated TypeScript [`TaskType`](src/lib/types.ts).
  - Added filter buttons to [`src/components/task-filters.tsx`](src/components/task-filters.tsx).
  - Added to dropdown in [`src/components/admin/task-editor-dialog.tsx`](src/components/admin/task-editor-dialog.tsx).

### 3. Vercel Web Analytics Integration
- **Commit**: `ae90c41`
- **Description**: Installed `@vercel/analytics` and integrated `<Analytics />` from `@vercel/analytics/next` in [`src/app/layout.tsx`](src/app/layout.tsx).
- **Setup Note**: Must be toggled **Enabled** in the Vercel Dashboard under the project's **Analytics** tab. Does not track `localhost` in development mode.

### 4. Task Editor Date & Time Separation
- **Commit**: `75ae8e5` & `2baf37e`
- **Description**:
  - Due Date (`<input type="date">`) and optional Due Time (`<input type="time">`) are split into two inputs in [`src/components/admin/task-editor-dialog.tsx`](src/components/admin/task-editor-dialog.tsx).
  - If no time is specified, it automatically defaults to `11:59 PM` (23:59 Asia/Kolkata).
  - Subject input defaults to `"General"` if left empty.

### 5. Onboarding Guide Modal
- **Commit**: `3776f7c` & `1c9d8e6`
- **Description**: Added an onboarding guide modal for new students with a "Don't show again" checkbox (persisted in `localStorage`) and a permanent "Guide" button in the Navbar.

### 6. Complaints System Enhancements
- **Commit**: `3cf375c`, `ddfdca9`, `abb8469`
- **Description**:
  - Permanent delete complaint button in the CR dashboard (`admin_delete_complaint` RPC).
  - Dual notifications: notifies all registered CR emails when a complaint is filed and sends confirmation receipt to the student.
  - Support for Anonymous or Display Name submission.

---

## 🗄️ Supabase Migrations Checklist (For Remote DB)

When setting up or verifying the live Supabase project, ensure these SQL queries have been executed in the **Supabase Dashboard > SQL Editor**:

1. **Add Task Types (`Exam`, `Registration`)**:
   ```sql
   ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'Exam';
   ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'Registration';
   ```
   *(File: `supabase/add_task_types_exam_registration.sql`)*

2. **Add Student Deletion RPC**:
   ```sql
   -- Run contents of supabase/admin_delete_student.sql
   ```

3. **Full Schema Reference**:
   - `supabase/full_schema.sql` contains the canonical, cumulative database schema.

---

## 🏗️ Architecture & Conventions
- **Framework**: Next.js 16 (App Router + Turbopack)
- **Language**: TypeScript (`strict: true`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/turbopack`)
- **Auth & Database**: Supabase SSR (`@supabase/ssr`, `@supabase/supabase-js`)
- **Timezone**: Asia/Kolkata (`date-fns-tz`)
- **Notifications**: Resend Email API + Web Push (VAPID)
- **Analytics**: `@vercel/analytics`
