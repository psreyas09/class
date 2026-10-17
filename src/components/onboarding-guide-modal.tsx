"use client";

import { useEffect, useState } from "react";
import {
  HelpCircle,
  CheckSquare,
  FolderOpen,
  ShieldCheck,
  Bell,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface OnboardingGuideModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

const STORAGE_KEY = "classdesk_guide_dismissed_v1";

export function OnboardingGuideModal({
  isOpen,
  onClose,
}: OnboardingGuideModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  function handleClose() {
    if (dontShowAgain && typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // Ignored
      }
    }
    onClose(dontShowAgain);
  }

  const features = [
    {
      icon: CheckSquare,
      title: "Coursework & Tasks",
      tag: "Live Deadlines",
      description:
        "Track upcoming assignments, lab records, reference records, and college forms with live IST countdowns. Completed & overdue tasks stay visible for 4 days before archiving.",
      accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-200 dark:border-amber-900/40",
    },
    {
      icon: FolderOpen,
      title: "Shared Class Resources",
      tag: "1-Click Drive",
      description:
        "Click the prominent 'Resources' button in the top navigation bar to access the shared Google Drive folder with class notes, textbook PDFs, question banks, and lab manuals.",
      accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-200 dark:border-blue-900/40",
    },
    {
      icon: ShieldCheck,
      title: "Complaints & Feedback",
      tag: "100% Anonymous Option",
      description:
        "Report issues, timetable conflicts, or suggestions directly to Class Representatives (CRs). You can submit named or 100% anonymously with private resolution tracking.",
      accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/40",
    },
    {
      icon: Bell,
      title: "Instant Alerts & Updates",
      tag: "Email & Web Push",
      description:
        "Receive automated email notifications whenever new tasks are scheduled or complaints are updated. Turn on the Bell icon in the navbar for browser push notifications.",
      accent: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-200 dark:border-purple-900/40",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                Welcome to ClassDesk
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono-numbers bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Quick Guide
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Your centralized college classroom platform for coursework, notes, and CR support.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-3 overflow-y-auto">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3.5 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${item.accent}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </h3>
                    <span className="text-[10px] font-mono-numbers font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
            />
            <span>Don&apos;t show this again</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-xs"
          >
            <span>Got it, Let&apos;s Go</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
