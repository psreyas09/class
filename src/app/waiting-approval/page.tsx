"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, RefreshCw, LogOut, GraduationCap, ShieldAlert } from "lucide-react";

export default function WaitingApprovalPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);
    }
    loadUser();
  }, [router]);

  async function checkStatus() {
    setChecking(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (profile?.is_approved || isAdmin) {
      router.push("/");
      router.refresh();
      return;
    }

    setChecking(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 bg-[var(--background)]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          </div>
          <span className="font-semibold text-sm tracking-tight">{appName}</span>
        </div>
        <div className="font-mono-numbers text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Pending Verification
        </div>
      </header>

      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-6 sm:p-8 rounded">
          <div className="w-10 h-10 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center mb-5 text-amber-700 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>

          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Account Pending Approval
          </h1>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
            Your account has been registered with email{" "}
            <span className="font-mono-numbers text-zinc-900 dark:text-zinc-100 font-medium">
              {email || "..."}
            </span>
            . For privacy and security, one of the two Class Representatives (CRs)
            must approve your access before you can view active assignments and class materials.
          </p>

          <div className="mt-6 p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-[11px] text-zinc-500 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <span>
              If you are in a rush for a deadline, contact your CR directly to approve your account from their admin panel.
            </span>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
              />
              <span>{checking ? "Checking..." : "Re-check Approval"}</span>
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-400">
        <p>Restricted to enrolled students and verified class admins</p>
      </footer>
    </div>
  );
}
