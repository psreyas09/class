import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { Task, AdminComplaintViewRow, Profile, Admin } from "@/lib/types";

import { headers } from "next/headers";
import { getCachedDriveUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const headerList = await headers();
  let userId = headerList.get("x-user-id");
  let userEmail = headerList.get("x-user-email");
  let userName = headerList.get("x-user-name");

  const supabase = await createClient();

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userId = user.id;
    userEmail = user.email || "";
    userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "";
  }

  // Strict backend admin check
  const isPrimary = userEmail?.toLowerCase() === "psreyas09@gmail.com";
  if (!isPrimary) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      redirect("/");
    }
  }

  // Fetch all dashboard data concurrently in parallel
  const [
    driveUrl,
    crRes,
    activeTasksRes,
    archivedTasksRes,
    complaintsRes,
    profilesRes,
  ] = await Promise.all([
    getCachedDriveUrl(),
    supabase.rpc("admin_get_cr_list").then(
      (res) => res,
      () => ({ data: [] as Admin[] })
    ),
    supabase
      .from("tasks")
      .select("*")
      .eq("is_archived", false)
      .order("due_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("is_archived", true)
      .order("due_at", { ascending: false }),
    supabase
      .from("admin_complaints_view")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  let crList: Admin[] = (crRes.data as Admin[]) ?? [];
  if (!crList.some((a) => a.email.toLowerCase() === "psreyas09@gmail.com")) {
    crList.unshift({
      email: "psreyas09@gmail.com",
      role: "primary",
      created_at: new Date().toISOString(),
    });
  }

  const activeTasksData = activeTasksRes.data ?? [];
  const archivedTasksData = archivedTasksRes.data ?? [];
  const complaintsData = complaintsRes.data ?? [];
  const profilesData = profilesRes.data ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={true}
        userEmail={userEmail ?? undefined}
        userName={userName ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <AdminDashboard
          initialActiveTasks={(activeTasksData as Task[]) ?? []}
          initialArchivedTasks={(archivedTasksData as Task[]) ?? []}
          initialComplaints={(complaintsData as AdminComplaintViewRow[]) ?? []}
          initialProfiles={(profilesData as Profile[]) ?? []}
          initialDriveUrl={driveUrl}
          initialCrList={crList}
          isPrimaryAdmin={isPrimary}
        />
      </main>
    </div>
  );
}
