"use client";

import { useState, useMemo } from "react";
import { Profile, Announcement, AnnouncementPriority } from "@/lib/types";
import { formatKolkataDateTime } from "@/lib/date-utils";
import {
  Megaphone,
  Mail,
  Bell,
  Users,
  Search,
  Check,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface AnnouncementBroadcastSectionProps {
  profiles: Profile[];
  initialAnnouncements?: Announcement[];
  onAnnouncementCreated?: (announcement: Announcement) => void;
}

export function AnnouncementBroadcastSection({
  profiles,
  initialAnnouncements = [],
  onAnnouncementCreated,
}: AnnouncementBroadcastSectionProps) {
  const approvedProfiles = useMemo(
    () => profiles.filter((p) => p.is_approved && p.email?.includes("@")),
    [profiles]
  );

  // Form states
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [link, setLink] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);

  // Audience selection states
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Submission & status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // History state
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered student list for selection
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return approvedProfiles;
    const q = searchQuery.toLowerCase().trim();
    return approvedProfiles.filter(
      (p) =>
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [approvedProfiles, searchQuery]);

  const targetCount =
    targetMode === "all" ? approvedProfiles.length : selectedUserIds.length;

  // Toggle single user
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all matching search
  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredProfiles.map((p) => p.id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  // Clear all selections
  const handleDeselectAll = () => {
    setSelectedUserIds([]);
  };

  // Send announcement
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle || !cleanMessage) {
      setStatusFeedback({
        type: "error",
        message: "Please provide both an announcement title and message.",
      });
      return;
    }

    if (!sendEmail && !sendPush) {
      setStatusFeedback({
        type: "error",
        message: "Please enable at least one notification channel (Email or Browser).",
      });
      return;
    }

    if (targetMode === "selected" && selectedUserIds.length === 0) {
      setStatusFeedback({
        type: "error",
        message: "Please select at least one student recipient or switch to 'All Students'.",
      });
      return;
    }

    const channelList = [
      sendEmail ? "Email" : null,
      sendPush ? "Browser Push" : null,
    ]
      .filter(Boolean)
      .join(" & ");

    const confirmMsg =
      targetMode === "all"
        ? `Send announcement to ALL ${approvedProfiles.length} students via ${channelList}?`
        : `Send announcement to ${selectedUserIds.length} selected students via ${channelList}?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/announcements/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          message: cleanMessage,
          priority,
          link: link.trim() || undefined,
          sendEmail,
          sendPush,
          targetAll: targetMode === "all",
          targetUserIds: targetMode === "all" ? [] : selectedUserIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to broadcast announcement.");
      }

      setStatusFeedback({
        type: "success",
        message: `Broadcast successfully sent! Delivered ${data.emailsSent} email(s) and ${data.pushSent} browser push notification(s) to ${data.targetCount} student(s).`,
      });

      // Reset form fields
      setTitle("");
      setMessage("");
      setLink("");
      setPriority("normal");
      if (targetMode === "selected") {
        setSelectedUserIds([]);
      }

      if (data.announcement) {
        setAnnouncements((prev) => [data.announcement, ...prev]);
        if (onAnnouncementCreated) {
          onAnnouncementCreated(data.announcement);
        }
      }
    } catch (err: unknown) {
      setStatusFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Broadcast failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete announcement
  const handleDeleteAnnouncement = async (id: string, annTitle: string) => {
    if (!confirm(`Are you sure you want to delete this announcement record?\n\n"${annTitle}"`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/announcements/broadcast?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      } else {
        const err = await res.json();
        alert(`Failed to delete announcement: ${err.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 sm:p-5 rounded space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Broadcast Announcement to Class</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Type announcements directly as Class Representative and trigger instant notifications via email and browser web push to the entire class or custom selected students.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300">
              {approvedProfiles.length} Registered Students
            </span>
          </div>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {statusFeedback && (
        <div
          className={`p-3.5 rounded border text-xs flex items-start gap-2.5 transition-all ${
            statusFeedback.type === "success"
              ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
              : "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
          }`}
        >
          {statusFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-relaxed">{statusFeedback.message}</div>
        </div>
      )}

      {/* Composer Form Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 sm:p-5 rounded space-y-5">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono-numbers flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Compose New Announcement</span>
        </h3>

        <form onSubmit={handleSendAnnouncement} className="space-y-4">
          {/* Title & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Announcement Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Schedule Change, Exam Guidelines, Lab Submission Notice..."
                className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              >
                <option value="normal">📢 Normal (Standard)</option>
                <option value="important">⭐ Important (Action Required)</option>
                <option value="urgent">🚨 Urgent (Immediate Attention)</option>
              </select>
            </div>
          </div>

          {/* Announcement Message Content */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Announcement Message <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-mono-numbers text-zinc-400">
                {message.length} characters
              </span>
            </div>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your announcement details here. Break paragraphs clearly — this text will be formatted and delivered via email and browser push notifications..."
              className="w-full px-3 py-2.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 leading-relaxed font-sans"
            />
          </div>

          {/* Optional Action / Resource Link */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Resource or Attachment URL <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/... or Google Form / Document link"
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
            />
          </div>

          {/* Channels Selection */}
          <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-2">
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Notification Channels
            </label>
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-medium">
                  <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Send Mail Notification</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-medium">
                  <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Send Browser Notification</span>
                </span>
              </label>
            </div>
          </div>

          {/* Audience Selection Section */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded p-3.5 sm:p-4 space-y-3 bg-white dark:bg-zinc-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Target Recipients</span>
                </label>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Choose whether to notify the entire class or select specific students.
                </p>
              </div>

              {/* Target Mode Toggle */}
              <div className="flex items-center gap-1 p-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setTargetMode("all")}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    targetMode === "all"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  All Users ({approvedProfiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("selected")}
                  className={`px-3 py-1 rounded transition-colors font-medium ${
                    targetMode === "selected"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  Select Users ({selectedUserIds.length})
                </button>
              </div>
            </div>

            {/* If Selected Students Mode is Active */}
            {targetMode === "selected" && (
              <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search students by name or email..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Select All Filtered
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Deselect All
                    </button>
                    <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-300/50 dark:border-amber-900/40">
                      {selectedUserIds.length} / {approvedProfiles.length} Selected
                    </span>
                  </div>
                </div>

                {/* Student Selection Scroll List */}
                <div className="max-h-60 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded divide-y divide-zinc-200 dark:divide-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                  {filteredProfiles.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      No students found matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredProfiles.map((p) => {
                      const isSelected = selectedUserIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleUserSelection(p.id)}
                          className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? "bg-amber-50/60 dark:bg-amber-950/20"
                              : "hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by row onClick
                              className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                                <span>{p.full_name || "Student"}</span>
                                <span className="text-[10px] text-zinc-400 font-mono-numbers">
                                  ({p.email})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono-numbers text-amber-700 dark:text-amber-400 font-semibold">
                                <Check className="w-3 h-3" />
                                Selected
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono-numbers text-zinc-400">
                                Click to add
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                Targeting:{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {targetMode === "all"
                    ? `All ${approvedProfiles.length} students`
                    : `${selectedUserIds.length} selected student(s)`}
                </strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || targetCount === 0 || (!sendEmail && !sendPush)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Broadcasting Notifications...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Send Announcement ({targetCount} {targetCount === 1 ? "student" : "students"})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono-numbers flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-zinc-400" />
            <span>Broadcast History ({announcements.length})</span>
          </h3>
        </div>

        {announcements.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-500">
            No announcements broadcasted yet. Use the form above to send your first class announcement.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const priorityBadge =
                ann.priority === "urgent"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-300/50 dark:border-red-900/40"
                  : ann.priority === "important"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50 dark:border-amber-900/40"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";

              return (
                <div
                  key={ann.id}
                  className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 rounded space-y-3 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-numbers font-semibold border ${priorityBadge}`}
                        >
                          {ann.priority.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400">
                          {ann.target_type === "all"
                            ? "All Students"
                            : `${ann.target_count || ann.target_user_ids?.length || 0} Selected`}
                        </span>
                        <span className="text-[11px] font-mono-numbers text-zinc-400">
                          {formatKolkataDateTime(ann.created_at)}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pt-0.5">
                        {ann.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono-numbers text-zinc-500">
                        <span className="flex items-center gap-1" title="Emails Sent">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{ann.emails_sent}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1" title="Browser Push Sent">
                          <Bell className="w-3 h-3 text-zinc-400" />
                          <span>{ann.push_sent}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={deletingId === ann.id}
                        onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50"
                        title="Delete announcement record"
                      >
                        {deletingId === ann.id ? (
                          <span className="w-3.5 h-3.5 block border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded border border-zinc-100 dark:border-zinc-800/60 font-sans">
                    {ann.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                    <div>
                      Broadcast by{" "}
                      <strong className="text-zinc-700 dark:text-zinc-300">
                        {ann.sender_name || "Class Representative"}
                      </strong>
                      {ann.sender_email && ` (${ann.sender_email})`}
                    </div>

                    {ann.link && (
                      <a
                        href={ann.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-medium"
                      >
                        <span>Open Resource Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
