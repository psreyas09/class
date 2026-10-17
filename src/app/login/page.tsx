"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GraduationCap, ArrowRight, ShieldCheck, Mail, Lock, UserPlus, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const supabase = createClient();

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setErrorMessage("Please enter your full name.");
          setLoading(false);
          return;
        }

        const callbackUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "https://class-chi-topaz.vercel.app/auth/callback";

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: callbackUrl,
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfoMessage(
            "Account created! If email confirmation is enabled, please verify your email. Otherwise you can now log in."
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 bg-[var(--background)]">
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          </div>
          <span className="font-semibold text-sm tracking-tight">{appName}</span>
        </div>
        <div className="font-mono-numbers text-xs text-zinc-500">
          Classroom Portal
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-sm w-full mx-auto my-auto py-8">
        <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-6 sm:p-8 rounded">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {isSignUp ? "Create an account" : "Sign in"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              {isSignUp
                ? "Register your student account to access class tasks and resources."
                : `Enter your credentials to access ${appName}.`}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-xs text-emerald-700 dark:text-emerald-400">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required={isSignUp}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@college.edu"
                  className="w-full px-3 py-2 pl-9 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 transition-colors"
                />
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-3 py-2 pl-9 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  {isSignUp ? (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Need an account? Register here"}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>CR-managed security · Passwords securely hashed by Supabase</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-400">
        <p>Built for classroom efficiency · Google Drive & Supabase connected</p>
      </footer>
    </div>
  );
}
