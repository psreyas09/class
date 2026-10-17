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
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin && !isPrimary) {
    redirect("/");
  }

  // Fetch CR list
  let crList: Admin[] = [];
  try {
    const { data: crData, error } = await supabase.rpc("admin_get_cr_list");
    if (!error && crData) {
      crList = crData as Admin[];
    }
  } catch {
    // fallback if migration not run yet
  }

  // Ensure primary admin is listed
  if (!crList.some((a) => a.email.toLowerCase() === "psreyas09@gmail.com")) {
    crList.unshift({
      email: "psreyas09@gmail.com",
      role: "primary",
      created_at: new Date().toISOString(),
    });
  }

  // Fetch Drive link
  const { data: settingData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "resources_drive_url")
    .maybeSingle();

  const driveUrl = settingData?.value || "https://drive.google.com";

  // Fetch active tasks
  const { data: activeTasksData } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_archived", false)
    .order("due_at", { ascending: true });

  // Fetch archived tasks
  const { data: archivedTasksData } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_archived", true)
    .order("due_at", { ascending: false });

  // Fetch complaints via admin_complaints_view (anonymous privacy preserved)
  const { data: complaintsData } = await supabase
    .from("admin_complaints_view")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch profiles for student approvals
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

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
