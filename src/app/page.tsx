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

  const isPrimary = user.email?.toLowerCase() === "psreyas09@gmail.com";

  // Execute all independent queries in parallel to drastically minimize TTFB
  const [adminRes, settingRes, tasksRes, profileRes] = await Promise.all([
    isPrimary ? Promise.resolve({ data: true }) : supabase.rpc("is_admin"),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "resources_drive_url")
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*")
      .order("due_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const isAdmin = isPrimary || !!adminRes.data;
  const settingData = settingRes.data;
  const tasks: Task[] = (tasksRes.data as Task[]) ?? [];
  const profile = profileRes.data;

  const driveUrl =
    settingData?.value && settingData.value !== "https://drive.google.com"
      ? settingData.value
      : "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU";

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
