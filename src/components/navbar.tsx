"use client";

import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import {
  FolderOpen,
  CheckSquare,
  MessageSquare,
  CheckCircle2,
  Shield,
  Sun,
  Moon,
  LogOut,
  GraduationCap,
  HelpCircle,
} from "lucide-react";
import { PushToggle } from "@/components/push-toggle";
import { OnboardingGuideModal } from "@/components/onboarding-guide-modal";

interface NavbarProps {
  initialDriveUrl?: string;
  initialIsAdmin?: boolean;
  userEmail?: string;
  userName?: string;
}

export function Navbar({
  initialDriveUrl = "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU",
  initialIsAdmin = false,
  userEmail,
  userName,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [driveUrl, setDriveUrl] = useState(initialDriveUrl);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [currentKolkataTime, setCurrentKolkataTime] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";

  useEffect(() => {
    setMounted(true);

    // Check if new joiner has already dismissed the platform guide
    try {
      const dismissed = localStorage.getItem("classdesk_guide_dismissed_v1");
      if (!dismissed) {
        setIsGuideOpen(true);
      }
    } catch {
      // Ignored in SSR
    }

    // Live clock in Asia/Kolkata
    function updateClock() {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      setCurrentKolkataTime(formatter.format(now));
    }
    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDriveUrl(initialDriveUrl);
  }, [initialDriveUrl]);

  useEffect(() => {
    setIsAdmin(initialIsAdmin);
  }, [initialIsAdmin]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navLinks = [
    { href: "/", label: "Tasks", icon: CheckSquare },
    { href: "/complaints", label: "Complaints", icon: MessageSquare },
    { href: "/resolved", label: "Resolved", icon: CheckCircle2 },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-[var(--background)]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-4">
          {/* Left: Branding & Clock */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 group focus:outline-none"
            >
              <div className="w-7 h-7 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                  {appName}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono-numbers leading-none">
                  {currentKolkataTime ? `${currentKolkataTime} IST` : "Portal"}
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 ml-5 border-l border-zinc-200 dark:border-zinc-800 pl-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                      isActive
                        ? "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Resources Button & Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Prominent Resources Button (opens Google Drive) */}
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Class Google Drive"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-amber-300 dark:border-amber-800/80 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 transition-colors shadow-xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">Resources</span>
            </a>

            {/* Push Notification Toggle */}
            {mounted && <PushToggle />}

            {/* Theme Toggle */}
            {mounted && (
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {theme === "dark" ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Platform Guide / Tutorial Button */}
            {mounted && (
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                title="ClassDesk Guide & Help"
                aria-label="Platform Guide"
                className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}

            {/* User / Sign Out */}
            <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-2 sm:pl-2.5">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 max-w-[120px] truncate leading-tight">
                  {userName || userEmail?.split("@")[0] || "User"}
                </span>
                {isAdmin ? (
                  <span className="text-[9px] font-mono-numbers text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
                    Admin (CR)
                  </span>
                ) : (
                  <span className="text-[9px] font-mono-numbers text-zinc-400">
                    Student
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed for 1-thumb thumb switching) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-[var(--background)]/95 backdrop-blur-md px-2 py-1 flex items-center justify-around">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] rounded transition-colors ${
                isActive
                  ? "text-amber-600 dark:text-amber-400 font-medium"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{link.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Onboarding Guide Modal */}
      {mounted && (
        <OnboardingGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      )}
    </>
  );
}
