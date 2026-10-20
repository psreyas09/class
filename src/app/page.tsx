import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { TaskBoard } from "@/components/task-board";
import { Task, Announcement } from "@/lib/types";

import { headers } from "next/headers";
import { getCachedDriveUrl } from "@/lib/settings";

// Dynamic SSR rendering with no stale static caching per project specification
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const headerList = await headers();
  let userId = headerList.get("x-user-id");
  let userEmail = headerList.get("x-user-email");
  let userName = headerList.get("x-user-name");

  const supabase = await createClient();

  // If request headers weren't populated, fall back to getUser()
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

  const isPrimary = userEmail?.toLowerCase() === "psreyas09@gmail.com";

  // Execute all independent operations in parallel
  const [driveUrl, adminRes, tasksRes, announcementsRes] = await Promise.all([
    getCachedDriveUrl(),
    isPrimary ? Promise.resolve({ data: true }) : supabase.rpc("is_admin"),
    supabase
      .from("tasks")
      .select("*")
      .order("due_at", { ascending: true }),
    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(
        (res) => res,
        () => ({ data: [] as Announcement[] })
      ),
  ]);

  const isAdmin = isPrimary || !!adminRes.data;
  const tasks: Task[] = (tasksRes.data as Task[]) ?? [];
  const announcements: Announcement[] = (announcementsRes.data as Announcement[]) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={!!isAdmin}
        userEmail={userEmail ?? undefined}
        userName={userName ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <TaskBoard
          initialTasks={tasks}
          driveUrl={driveUrl}
          isAdmin={!!isAdmin}
          initialAnnouncements={announcements}
        />
      </main>
    </div>
  );
}
