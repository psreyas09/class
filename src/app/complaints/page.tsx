import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ComplaintsClient } from "@/components/complaints-client";
import { Complaint } from "@/lib/types";

import { headers } from "next/headers";
import { getCachedDriveUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
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

  const isPrimary = userEmail?.toLowerCase() === "psreyas09@gmail.com";

  // Execute independent operations in parallel
  const [driveUrl, adminRes, complaintsRes] = await Promise.all([
    getCachedDriveUrl(),
    isPrimary ? Promise.resolve({ data: true }) : supabase.rpc("is_admin"),
    supabase
      .from("complaints")
      .select(`
        *,
        replies:complaint_replies(*)
      `)
      .order("created_at", { ascending: false }),
  ]);

  const isAdmin = isPrimary || !!adminRes.data;
  const complaints: Complaint[] = (complaintsRes.data as Complaint[]) ?? [];
  const defaultDisplayName = userName || userEmail?.split("@")[0] || "";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={!!isAdmin}
        userEmail={userEmail ?? undefined}
        userName={userName ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <ComplaintsClient
          initialComplaints={complaints}
          currentUserId={userId}
          defaultDisplayName={defaultDisplayName}
        />
      </main>
    </div>
  );
}
