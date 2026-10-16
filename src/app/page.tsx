import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { TaskBoard } from "@/components/task-board";
import { Task } from "@/lib/types";

// Dynamic SSR rendering with no stale static caching per project specification
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  // Strict identity check using getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch admin status
  const { data: isAdmin } = await supabase.rpc("is_admin");

  // Fetch Drive resources URL from settings
  const { data: settingData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "resources_drive_url")
    .maybeSingle();

  const driveUrl = settingData?.value || "https://drive.google.com";

  // Fetch active tasks sorted by nearest due date
  // RLS automatically enforces: is_archived = false AND due_at + interval '4 days' > now()
  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .order("due_at", { ascending: true });

  const tasks: Task[] = tasksData ?? [];

  // Fetch user profile for name display
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={!!isAdmin}
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <TaskBoard
          initialTasks={tasks}
          driveUrl={driveUrl}
          isAdmin={!!isAdmin}
        />
      </main>
    </div>
  );
}
