"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Complaint, ComplaintCategory } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { formatKolkataShort } from "@/lib/date-utils";
import {
  MessageSquare,
  Plus,
  Send,
  EyeOff,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  CornerDownRight,
  ShieldCheck,
  User,
} from "lucide-react";

interface ComplaintsClientProps {
  initialComplaints: Complaint[];
  currentUserId: string;
  defaultDisplayName?: string;
}

const CATEGORIES: ComplaintCategory[] = [
  "Infrastructure",
  "Academic",
  "Timetable",
  "Other",
];

export function ComplaintsClient({
  initialComplaints,
  currentUserId,
  defaultDisplayName = "",
}: ComplaintsClientProps) {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("Infrastructure");
  const [description, setDescription] = useState("");
  const [submissionMode, setSubmissionMode] = useState<"named" | "anonymous">("named");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const isAnonymous = submissionMode === "anonymous";
    let finalDisplayName: string | null = null;

    if (!trimmedTitle) {
      setFormError("Please enter a title for your complaint.");
      return;
    }
    if (trimmedTitle.length > 120) {
      setFormError("Title must be 120 characters or less.");
      return;
    }
    if (!trimmedDesc) {
      setFormError("Please explain your complaint in the description.");
      return;
    }
    if (trimmedDesc.length > 2000) {
      setFormError("Description must be 2000 characters or less.");
      return;
    }

    if (!isAnonymous) {
      finalDisplayName = displayName.trim() || defaultDisplayName || "Student";
      if (finalDisplayName.length > 100) {
        setFormError("Display name must be 100 characters or less.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("complaints")
        .insert({
          student_id: currentUserId,
          title: trimmedTitle,
          category,
          description: trimmedDesc,
          display_name: finalDisplayName,
          is_anonymous: isAnonymous,
          status: "Open",
        })
        .select()
        .single();

      if (error) {
        setFormError(error.message);
        setIsSubmitting(false);
        return;
      }

      // Prepend to local state
      setComplaints([data as Complaint, ...complaints]);
      setTitle("");
      setDescription("");
      setSubmissionMode("named");
      setShowForm(false);
      setIsSubmitting(false);
      router.refresh();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit complaint"
      );
      setIsSubmitting(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <Clock className="w-3 h-3 text-zinc-500" />
            Open
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-300/60 dark:border-amber-900/40">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            In Progress
          </span>
        );
      case "Fixed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-900/40">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Fixed
          </span>
        );
      case "Cannot Be Fixed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-300/60 dark:border-rose-900/40">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Cannot Be Fixed
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section with CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Complaints & Queries
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Submit issues directly to your Class Representatives. You can post anonymously.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showForm ? "Close Form" : "New Complaint"}</span>
        </button>
      </div>

      {/* New Complaint Form Drawer/Box */}
      {showForm && (
        <section
          aria-label="New Complaint Form"
          className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 sm:p-5 rounded space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono-numbers">
              Submit a Complaint
            </h2>
            <span className="text-[11px] text-zinc-500">
              Only CRs see your issue
            </span>
          </div>

          {formError && (
            <div className="p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title{" "}
                  <span className="text-[10px] text-zinc-400 font-mono-numbers">
                    ({title.length}/120)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Projector loose HDMI cable in Room 302"
                  className="w-full px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Detailed Description{" "}
                <span className="text-[10px] text-zinc-400 font-mono-numbers">
                  ({description.length}/2000)
                </span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's wrong, room number, affected time, or specific details so CRs can follow up with faculty or administration..."
                className="w-full px-3 py-2 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              />
            </div>

            {/* Identity Selection: Display Name vs Anonymous */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Identity on Complaint
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded border cursor-pointer transition-colors ${
                    submissionMode === "named"
                      ? "border-amber-500/80 bg-amber-500/5 dark:bg-amber-500/10"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="submission-mode"
                    value="named"
                    checked={submissionMode === "named"}
                    onChange={() => setSubmissionMode("named")}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>With Display Name</span>
                    </span>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      CRs will see your chosen display name and can follow up directly.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded border cursor-pointer transition-colors ${
                    submissionMode === "anonymous"
                      ? "border-amber-500/80 bg-amber-500/5 dark:bg-amber-500/10"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="submission-mode"
                    value="anonymous"
                    checked={submissionMode === "anonymous"}
                    onChange={() => setSubmissionMode("anonymous")}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Post Anonymously</span>
                    </span>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      100% confidential. Your name and email are masked to CRs.
                    </p>
                  </div>
                </label>
              </div>

              {submissionMode === "named" && (
                <div className="pt-1.5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Display Name{" "}
                    <span className="text-[10px] text-zinc-400 font-mono-numbers">
                      ({displayName.length}/100)
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rahul S. (Roll 24)"
                    className="w-full px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    This is the name CRs will see on this complaint.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Submitting..." : "Submit Complaint"}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* My Complaints List */}
      <section aria-label="My Complaints List">
        <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono-numbers uppercase tracking-wider mb-3">
          My Submissions ({complaints.length})
        </h2>

        {complaints.length === 0 ? (
          <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded">
            <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 mx-auto flex items-center justify-center text-zinc-400 mb-3">
              <MessageSquare className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No complaints submitted yet
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Got an issue with labs, timetable clashes, or classroom equipment? Click "New Complaint" to log it for your CRs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <article
                key={c.id}
                className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 rounded space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {c.category}
                    </span>
                    {c.is_anonymous ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono-numbers rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                        <EyeOff className="w-2.5 h-2.5" />
                        Anonymous
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono-numbers rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <User className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                        {c.display_name || "With Name"}
                      </span>
                    )}
                    <span className="text-[11px] font-mono-numbers text-zinc-400">
                      {formatKolkataShort(c.created_at)}
                    </span>
                  </div>

                  <div>{getStatusBadge(c.status)}</div>
                </div>

                {/* Complaint Title & Description */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 whitespace-pre-wrap leading-relaxed">
                    {c.description}
                  </p>
                </div>

                {/* Replies Thread */}
                {c.replies && c.replies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                    <span className="text-[11px] font-mono-numbers uppercase text-zinc-400 flex items-center gap-1 font-semibold tracking-wider">
                      <CornerDownRight className="w-3 h-3" />
                      CR Replies ({c.replies.length})
                    </span>

                    {c.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            {reply.admin_name}
                          </span>
                          <span className="text-[10px] font-mono-numbers text-zinc-400">
                            {formatKolkataShort(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {reply.reply_text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
