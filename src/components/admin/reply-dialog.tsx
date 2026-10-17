"use client";

import { useState } from "react";
import { AdminComplaintViewRow, ComplaintStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { X, Send, AlertCircle, EyeOff } from "lucide-react";

interface ReplyDialogProps {
  complaint: AdminComplaintViewRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (complaintId: string, newStatus: ComplaintStatus, replyText: string) => void;
}

const STATUSES: ComplaintStatus[] = [
  "Open",
  "In Progress",
  "Fixed",
  "Cannot Be Fixed",
];

export function ReplyDialog({
  complaint,
  isOpen,
  onClose,
  onSuccess,
}: ReplyDialogProps) {
  const [status, setStatus] = useState<ComplaintStatus>(
    complaint?.status || "In Progress"
  );
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !complaint) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complaint) return;
    setError(null);

    const trimmedReply = replyText.trim();

    // Specific rule check: When marking Cannot Be Fixed, a reply explaining reason is required
    if (status === "Cannot Be Fixed" && !trimmedReply) {
      setError("An explanation is required when marking a complaint as 'Cannot Be Fixed'.");
      return;
    }

    if (trimmedReply.length > 2000) {
      setError("Reply text must be 2000 characters or less.");
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "admin_reply_to_complaint",
        {
          p_complaint_id: complaint.id,
          p_reply: trimmedReply,
          p_status: status,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      // Notify the student who registered this complaint about the update
      try {
        await fetch("/api/complaints/notify-student", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            complaintId: complaint.id,
            status,
            replyText: trimmedReply,
          }),
        });
      } catch (err) {
        console.warn("Failed to dispatch student notification:", err);
      }

      onSuccess(complaint.id, status, trimmedReply);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record reply");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-5 sm:p-6 rounded shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Reply & Update Status
            </h2>
            <span className="text-[11px] text-zinc-500">
              Admin response recorded with your name and timestamp
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Complaint Context Summary */}
        <div className="mb-4 p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="font-mono-numbers">{complaint.category}</span>
            {complaint.is_anonymous ? (
              <span className="flex items-center gap-1 text-zinc-400">
                <EyeOff className="w-3 h-3" />
                Anonymous Student
              </span>
            ) : (
              <span>
                From:{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {complaint.student_name || "Student"}
                </strong>{" "}
                ({complaint.student_email})
              </span>
            )}
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {complaint.title}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
            {complaint.description}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Complaint Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
              className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 cursor-pointer"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
              <span>
                Admin Response / Reason{" "}
                {status === "Cannot Be Fixed" && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    (Required)
                  </span>
                )}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono-numbers">
                ({replyText.length}/2000)
              </span>
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              required={status === "Cannot Be Fixed"}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                status === "Cannot Be Fixed"
                  ? "Explain clearly why this issue cannot be resolved by CRs or faculty..."
                  : "Write your update or reply for the student..."
              }
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "Recording..." : "Submit Reply"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
