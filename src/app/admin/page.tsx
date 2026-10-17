import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { Task, AdminComplaintViewRow, Profile, Admin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Strict backend admin check
  const isPrimary = user.email?.toLowerCase() === "psreyas09@gmail.com";
  if (!isPrimary) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      redirect("/");
    }
  }

  // Fetch all dashboard data concurrently in parallel
  const [
    crRes,
    settingRes,
    activeTasksRes,
    archivedTasksRes,
    complaintsRes,
    profilesRes,
    profileRes,
  ] = await Promise.all([
    supabase.rpc("admin_get_cr_list").then(
      (res) => res,
      () => ({ data: [] as Admin[] })
    ),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "resources_drive_url")
      .maybeSingle(),
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
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  let crList: Admin[] = (crRes.data as Admin[]) ?? [];
  if (!crList.some((a) => a.email.toLowerCase() === "psreyas09@gmail.com")) {
    crList.unshift({
      email: "psreyas09@gmail.com",
      role: "primary",
      created_at: new Date().toISOString(),
    });
  }

  const driveUrl =
    settingRes.data?.value &&
    settingRes.data.value !== "https://drive.google.com"
      ? settingRes.data.value
      : "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU";

  const activeTasksData = activeTasksRes.data ?? [];
  const archivedTasksData = archivedTasksRes.data ?? [];
  const complaintsData = complaintsRes.data ?? [];
  const profilesData = profilesRes.data ?? [];
  const profile = profileRes.data;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={true}
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
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
