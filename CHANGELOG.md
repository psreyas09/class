# Changelog

All notable changes to the ClassDesk project are documented in this file.

## [Unreleased] - 2026-10-18

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
