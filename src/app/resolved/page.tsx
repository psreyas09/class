import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ResolvedComplaintViewRow } from "@/lib/types";
import { formatKolkataShort } from "@/lib/date-utils";
import { CheckCircle2, XCircle, ShieldCheck, CornerDownRight, MessageSquareCheck } from "lucide-react";

import { headers } from "next/headers";
import { getCachedDriveUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ResolvedPage() {
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

  // Execute independent queries in parallel
  const [driveUrl, adminRes, resolvedRes] = await Promise.all([
    getCachedDriveUrl(),
    isPrimary ? Promise.resolve({ data: true }) : supabase.rpc("is_admin"),
    supabase
      .from("resolved_complaints_view")
      .select("*")
      .order("updated_at", { ascending: false }),
  ]);

  const isAdmin = isPrimary || !!adminRes.data;
  const resolvedList: ResolvedComplaintViewRow[] = resolvedRes.data ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar
        initialDriveUrl={driveUrl}
        initialIsAdmin={!!isAdmin}
        userEmail={userEmail ?? undefined}
        userName={userName ?? undefined}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
        <div className="space-y-6">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Public Resolved Log</span>
              <span className="text-[10px] font-mono-numbers text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20">
                Class Transparency
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Browse handled class queries and resolutions. Student names and raw descriptions are omitted for privacy.
            </p>
          </div>

          {resolvedList.length === 0 ? (
            <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded">
              <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 mx-auto flex items-center justify-center text-zinc-400 mb-3">
                <MessageSquareCheck className="w-5 h-5 text-zinc-400" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                No resolved issues yet
              </h2>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                When CRs address and resolve complaints, the outcome and resolution notes will be posted here for everyone to see.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedList.map((item) => (
                <article
                  key={item.id}
                  className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 rounded space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {item.category}
                      </span>
                      <span className="text-[11px] font-mono-numbers text-zinc-400">
                        Resolved {formatKolkataShort(item.updated_at)}
                      </span>
                    </div>

                    <div>
                      {item.status === "Fixed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-900/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Fixed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-300/60 dark:border-rose-900/40">
                          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Cannot Be Fixed
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h3>

                  {item.latest_reply && (
                    <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 space-y-1">
                      <span className="text-[11px] font-mono-numbers uppercase text-zinc-400 flex items-center gap-1 font-semibold tracking-wider">
                        <CornerDownRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        CR Resolution Note
                      </span>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {item.latest_reply}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
