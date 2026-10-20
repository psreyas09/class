# Changelog

All notable changes to the ClassDesk project are documented in this file.

## [Unreleased] - 2026-10-20

### Added
- **CR Announcement Broadcast System (Email & Browser Notifications)**:
  - Added dedicated **Announcements** tab in CR Admin Control with broadcast management and delivery tracking ([`src/components/admin/admin-dashboard.tsx`](src/components/admin/admin-dashboard.tsx)).
  - Built interactive [Announcement Composer](src/components/admin/announcement-broadcast-section.tsx) allowing CRs to type custom announcements, choose priority (`Normal`, `Important`, `Urgent`), attach optional links, and select delivery channels (Email and Browser Push).
  - Added flexible audience selection: broadcast to **All Students** or **Select Specific Students** with instant name/email search, "Select All Filtered", and per-student checkboxes.
  - Built backend broadcast route ([`src/app/api/announcements/broadcast/route.ts`](src/app/api/announcements/broadcast/route.ts)) sending HTML emails (Gmail SMTP / Resend) and Web Push notifications to selected users' devices.
  - Added database persistence and RLS security in [`supabase/announcements_schema.sql`](supabase/announcements_schema.sql).
  - Added top Announcement Notice banner with collapsible history on the student homepage ([`src/components/task-board.tsx`](src/components/task-board.tsx)).
- **Push Notification Troubleshooting**:
  - Added Brave browser Google services push messaging guidance and abort error handling in [`src/components/push-toggle.tsx`](src/components/push-toggle.tsx).

## [0.1.0] - 2026-10-18

### Added
- **Permanent Student Removal**:
  - Added `admin_delete_user` RPC function in [`supabase/admin_delete_student.sql`](supabase/admin_delete_student.sql) and [`supabase/full_schema.sql`](supabase/full_schema.sql) allowing admins to permanently purge student accounts from `auth.users`, cascading through profiles, push subscriptions, and complaints.
  - Added dedicated Remove Student action (trash button) with confirmation warning in the Admin Dashboard **Student Approvals** tab (`src/components/admin/admin-dashboard.tsx`).
  - Added guardrails preventing self-deletion and preventing deletion of accounts holding active CR or Admin roles.
- **New Task Types**:
  - Added `Exam` and `Registration` types to the `public.task_type` database enum ([`supabase/add_task_types_exam_registration.sql`](supabase/add_task_types_exam_registration.sql)).
  - Updated `TaskType` TypeScript union in [`src/lib/types.ts`](src/lib/types.ts).
  - Updated Task Filter buttons on student task board ([`src/components/task-filters.tsx`](src/components/task-filters.tsx)).
  - Updated Task Editor dialog dropdown for CRs ([`src/components/admin/task-editor-dialog.tsx`](src/components/admin/task-editor-dialog.tsx)).
- **Vercel Analytics**:
  - Installed `@vercel/analytics`.
  - Added `<Analytics />` component to root layout ([`src/app/layout.tsx`](src/app/layout.tsx)).
- **Onboarding Guide Modal**:
  - New user onboarding popup explaining key features with a "Don't show again" toggle persisted in `localStorage` ([`src/components/onboarding-guide-modal.tsx`](src/components/onboarding-guide-modal.tsx)).
  - Permanent "Guide" button in the Navbar.
- **Task Due Date & Time Separation**:
  - Due Date and optional Due Time inputs separated in the Task Editor dialog, defaulting to 11:59 PM if time is omitted.
  - Optional Subject input defaulting to "General".
- **Complaint Management**:
  - Delete complaint capability in CR Admin Dashboard with `admin_delete_complaint` RPC.
  - Broadcast notification emails to all CRs on new complaints.
  - Confirmation receipts sent to submitting students.
  - Anonymous or custom Display Name submission options.
