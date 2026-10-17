import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ComplaintsClient } from "@/components/complaints-client";
import { Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isPrimary = user.email?.toLowerCase() === "psreyas09@gmail.com";

  // Execute independent database queries in parallel
  const [adminRes, settingRes, complaintsRes, profileRes] = await Promise.all([
    isPrimary ? Promise.resolve({ data: true }) : supabase.rpc("is_admin"),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "resources_drive_url")
      .maybeSingle(),
    supabase
      .from("complaints")
      .select(`
        *,
        replies:complaint_replies(*)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const isAdmin = isPrimary || !!adminRes.data;
  const settingData = settingRes.data;
  const complaints: Complaint[] = (complaintsRes.data as Complaint[]) ?? [];
  const profile = profileRes.data;

  const driveUrl =
    settingData?.value && settingData.value !== "https://drive.google.com"
      ? settingData.value
      : "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU";

  const defaultDisplayName =
    profile?.full_name || user.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={!!isAdmin}
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <ComplaintsClient
          initialComplaints={complaints}
          currentUserId={user.id}
          defaultDisplayName={defaultDisplayName}
        />
      </main>
    </div>
  );
}
