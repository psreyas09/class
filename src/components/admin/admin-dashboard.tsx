"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Task,
  AdminComplaintViewRow,
  Profile,
  ComplaintStatus,
  Admin,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { formatKolkataDateTime, formatKolkataShort } from "@/lib/date-utils";
import { TaskEditorDialog } from "@/components/admin/task-editor-dialog";
import { ReplyDialog } from "@/components/admin/reply-dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  MessageSquare,
  Users,
  Settings,
  FolderOpen,
  EyeOff,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  CheckSquare,
} from "lucide-react";

interface AdminDashboardProps {
  initialActiveTasks: Task[];
  initialArchivedTasks: Task[];
  initialComplaints: AdminComplaintViewRow[];
  initialProfiles: Profile[];
  initialDriveUrl: string;
  initialCrList?: Admin[];
  isPrimaryAdmin?: boolean;
}

type TabType = "tasks" | "archive" | "complaints" | "approvals" | "crs" | "settings";

export function AdminDashboard({
  initialActiveTasks,
  initialArchivedTasks,
  initialComplaints,
  initialProfiles,
  initialDriveUrl,
  initialCrList = [],
  isPrimaryAdmin = false,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("tasks");

  // Tasks state
  const [activeTasks, setActiveTasks] = useState<Task[]>(initialActiveTasks);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>(initialArchivedTasks);
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Complaints state
  const [complaints, setComplaints] = useState<AdminComplaintViewRow[]>(initialComplaints);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [replyingComplaint, setReplyingComplaint] = useState<AdminComplaintViewRow | null>(null);
  const [deletingComplaintId, setDeletingComplaintId] = useState<string | null>(null);

  // Approvals state
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // CR Management state
  const [crList, setCrList] = useState<Admin[]>(initialCrList);
  const [newCrEmail, setNewCrEmail] = useState("");
  const [crLoading, setCrLoading] = useState(false);
  const [crMessage, setCrMessage] = useState<string | null>(null);
  const [crError, setCrError] = useState<string | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  // Settings state
  const effectiveDriveUrl =
    initialDriveUrl && initialDriveUrl !== "https://drive.google.com"
      ? initialDriveUrl
      : "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU";
  const [driveUrl, setDriveUrl] = useState(effectiveDriveUrl);
  const [savedDriveUrl, setSavedDriveUrl] = useState(effectiveDriveUrl);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // ================= CR MANAGEMENT ACTIONS =================
  async function handleAddCr(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = newCrEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setCrError("Please enter a valid email address.");
      return;
    }

    setCrLoading(true);
    setCrError(null);
    setCrMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("admin_add_cr", { p_email: cleanEmail });

    if (error) {
      setCrError(error.message);
    } else {
      setCrMessage(`Added ${cleanEmail} as Class Representative.`);
      setNewCrEmail("");
      if (!crList.some((a) => a.email.toLowerCase() === cleanEmail)) {
        setCrList([
          ...crList,
          { email: cleanEmail, role: "cr", created_at: new Date().toISOString() },
        ]);
      }
      router.refresh();
    }
    setCrLoading(false);
  }

  async function handleRemoveCr(email: string) {
    if (email.toLowerCase() === "psreyas09@gmail.com") {
      alert("Cannot remove primary admin account.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${email} as Class Representative?`)) {
      return;
    }

    setRemovingEmail(email);
    setCrError(null);
    setCrMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("admin_remove_cr", { p_email: email });

    if (error) {
      setCrError(error.message);
    } else {
      setCrMessage(`Removed ${email} from Class Representatives.`);
      setCrList(crList.filter((a) => a.email.toLowerCase() !== email.toLowerCase()));
      router.refresh();
    }
    setRemovingEmail(null);
  }

  // ================= TASK ACTIONS =================
  async function handleDeleteTask(taskId: string, isArchive: boolean) {
    if (!confirm("Are you sure you want to permanently delete this task?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) {
      if (isArchive) {
        setArchivedTasks(archivedTasks.filter((t) => t.id !== taskId));
      } else {
        setActiveTasks(activeTasks.filter((t) => t.id !== taskId));
      }
      router.refresh();
    }
  }

  async function handleArchiveTask(task: Task) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({ is_archived: true })
      .eq("id", task.id)
      .select()
      .single();

    if (!error && data) {
      setActiveTasks(activeTasks.filter((t) => t.id !== task.id));
      setArchivedTasks([data as Task, ...archivedTasks]);
      router.refresh();
    }
  }

  async function handleRestoreTask(task: Task) {
    // Restoring un-archives and sets due date to 3 days in future if it was past due
    const now = new Date();
    const isPastDue = new Date(task.due_at) < now;
    const newDueDate = isPastDue
      ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : task.due_at;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({ is_archived: false, due_at: newDueDate })
      .eq("id", task.id)
      .select()
      .single();

    if (!error && data) {
      setArchivedTasks(archivedTasks.filter((t) => t.id !== task.id));
      setActiveTasks([data as Task, ...activeTasks]);
      router.refresh();
    }
  }

  function handleTaskSaved(savedTask: Task, isNew: boolean) {
    if (isNew) {
      setActiveTasks([savedTask, ...activeTasks]);
    } else {
      setActiveTasks(
        activeTasks.map((t) => (t.id === savedTask.id ? savedTask : t))
      );
    }
    router.refresh();
  }

  // ================= COMPLAINTS =================
  const filteredComplaints = complaints.filter((c) => {
    if (selectedStatus !== "All" && c.status !== selectedStatus) return false;
    if (selectedCategory !== "All" && c.category !== selectedCategory) return false;
    return true;
  });

  function handleReplySuccess(
    complaintId: string,
    newStatus: ComplaintStatus,
    replyText: string
  ) {
    setComplaints(
      complaints.map((c) => {
        if (c.id === complaintId) {
          const updatedReplies = [
            ...(c.replies || []),
            {
              id: Math.random().toString(),
              complaint_id: complaintId,
              admin_id: "me",
              admin_name: "You (Admin)",
              reply_text: replyText,
              created_at: new Date().toISOString(),
            },
          ];
          return {
            ...c,
            status: newStatus,
            updated_at: new Date().toISOString(),
            replies: updatedReplies,
          };
        }
        return c;
      })
    );
    router.refresh();
  }

  async function handleDeleteComplaint(complaintId: string, title: string) {
    if (
      !confirm(
        `Are you sure you want to permanently delete this complaint?\n\n"${title}"\n\nThis will remove the complaint and all its replies. This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingComplaintId(complaintId);
      const supabase = createClient();

      // Try RPC first
      const { error: rpcErr } = await supabase.rpc("admin_delete_complaint", {
        p_complaint_id: complaintId,
      });

      if (rpcErr) {
        // Fallback to direct delete
        const { error: delErr } = await supabase
          .from("complaints")
          .delete()
          .eq("id", complaintId);

        if (delErr) {
          alert(`Failed to delete complaint: ${delErr.message}`);
          setDeletingComplaintId(null);
          return;
        }
      }

      setComplaints(complaints.filter((c) => c.id !== complaintId));
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete complaint");
    } finally {
      setDeletingComplaintId(null);
    }
  }

  // ================= APPROVALS =================
  async function handleSetApproval(userId: string, approved: boolean) {
    try {
      setApprovingId(userId);
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_set_user_approval", {
        p_user_id: userId,
        p_approved: approved,
      });

      if (!error) {
        setProfiles(
          profiles.map((p) =>
            p.id === userId ? { ...p, is_approved: approved } : p
          )
        );
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDeleteUser(userId: string, studentName: string) {
    if (
      !confirm(
        `Are you sure you want to permanently remove student "${studentName}"?\n\nThis will completely delete their account, profile, and student data. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingUserId(userId);
      const supabase = createClient();

      // 1. Try admin_delete_user RPC
      const { error: rpcErr } = await supabase.rpc("admin_delete_user", {
        p_user_id: userId,
      });

      if (rpcErr) {
        // Fallback: try direct delete from profiles table
        const { error: delErr } = await supabase
          .from("profiles")
          .delete()
          .eq("id", userId);

        if (delErr) {
          alert(`Failed to remove student: ${rpcErr.message || delErr.message}`);
          setDeletingUserId(null);
          return;
        }
      }

      setProfiles((prev) => prev.filter((p) => p.id !== userId));
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove student");
    } finally {
      setDeletingUserId(null);
    }
  }

  // ================= SETTINGS =================
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMessage(null);
    setSettingsError(null);

    const trimmedUrl = driveUrl.trim();
    if (!trimmedUrl.startsWith("https://")) {
      setSettingsError("Google Drive URL must start with https://");
      return;
    }

    try {
      setSettingsLoading(true);
      const supabase = createClient();
      const { error } = await supabase
        .from("settings")
        .upsert({
          key: "resources_drive_url",
          value: trimmedUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        setSettingsError(error.message);
      } else {
        setSavedDriveUrl(trimmedUrl);
        setSettingsMessage("Google Drive resources link saved successfully.");
      }
    } catch (err: unknown) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to update settings"
      );
    } finally {
      setSettingsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>CR Admin Control</span>
            <span className="text-[10px] font-mono-numbers text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20">
              Class Representative Access
            </span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage active tasks, archived deadlines, student query inbox, and user approvals.
          </p>
        </div>

        {activeTab === "tasks" && (
          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setIsTaskEditorOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-1 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "tasks"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Active Tasks ({activeTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("archive")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "archive"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archive ({archivedTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("complaints")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "complaints"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Complaints Inbox ({complaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("approvals")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "approvals"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Student Approvals ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("crs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "crs"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>CR Admins ({crList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Drive Link</span>
        </button>
      </div>

      {/* ================= TAB 1: ACTIVE TASKS ================= */}
      {activeTab === "tasks" && (
        <section className="space-y-3">
          {activeTasks.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-500">
              No active tasks. Click "Create Task" above to publish a new assignment or record deadline.
            </div>
          ) : (
            activeTasks.map((task) => (
              <div
                key={task.id}
                className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-3.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {task.type}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers font-semibold uppercase rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {task.subject}
                    </span>
                    <span className="text-[11px] font-mono-numbers text-zinc-500">
                      Due: {formatKolkataDateTime(task.due_at)}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {task.title}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(task);
                      setIsTaskEditorOpen(true);
                    }}
                    title="Edit task"
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArchiveTask(task)}
                    title="Move to archive"
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id, false)}
                    title="Delete permanently"
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ================= TAB 2: ARCHIVE ================= */}
      {activeTab === "archive" && (
        <section className="space-y-3">
          <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-500">
            Tasks in this archive have expired past the 4-day student visibility window or were manually archived. You can restore them (which updates their due date) or delete them permanently.
          </div>

          {archivedTasks.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-500">
              No archived tasks.
            </div>
          ) : (
            archivedTasks.map((task) => (
              <div
                key={task.id}
                className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-3.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 opacity-80 hover:opacity-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      Archived
                    </span>
                    <span className="text-[11px] font-mono-numbers text-zinc-400">
                      Expired: {formatKolkataShort(task.due_at)}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate line-through opacity-70">
                    {task.title}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestoreTask(task)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore (+3 days)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id, true)}
                    className="p-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-600"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ================= TAB 3: COMPLAINTS INBOX ================= */}
      {activeTab === "complaints" && (
        <section className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Filter Status:</span>
            {["All", "Open", "In Progress", "Fixed", "Cannot Be Fixed"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedStatus === st
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                    : "border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-500">
              No complaints in this view.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 rounded space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-1.5 py-0.5 text-[10px] font-mono-numbers rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {c.category}
                      </span>
                      {c.is_anonymous ? (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono-numbers">
                          <EyeOff className="w-3 h-3" />
                          Anonymous Student
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          By: <strong className="text-zinc-900 dark:text-zinc-100">{c.student_name}</strong> ({c.student_email})
                        </span>
                      )}
                      <span className="text-[11px] font-mono-numbers text-zinc-400">
                        {formatKolkataShort(c.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono-numbers font-medium px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {c.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => setReplyingComplaint(c)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90"
                      >
                        Reply / Resolve
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteComplaint(c.id, c.title)}
                        disabled={deletingComplaintId === c.id}
                        className="p-1.5 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50"
                        title="Delete complaint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {c.title}
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 whitespace-pre-wrap leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= TAB 4: STUDENT APPROVALS ================= */}
      {activeTab === "approvals" && (
        <section className="space-y-4">
          <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-500">
            All registered students automatically receive access upon signup. You can revoke access temporarily or permanently remove a student account.
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono-numbers">
                <tr>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {p.full_name || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono-numbers text-zinc-600 dark:text-zinc-400">
                      {p.email}
                    </td>
                    <td className="py-2.5 px-3 font-mono-numbers">
                      {p.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={approvingId === p.id || deletingUserId === p.id}
                          onClick={() => handleSetApproval(p.id, !p.is_approved)}
                          className={`px-2.5 py-1 text-xs rounded transition-colors ${
                            p.is_approved
                              ? "border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-800"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          }`}
                        >
                          {approvingId === p.id
                            ? "Saving..."
                            : p.is_approved
                            ? "Revoke Access"
                            : "Approve Access"}
                        </button>

                        <button
                          type="button"
                          disabled={approvingId === p.id || deletingUserId === p.id}
                          onClick={() => handleDeleteUser(p.id, p.full_name || p.email)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50"
                          title="Permanently remove student account"
                        >
                          {deletingUserId === p.id ? (
                            <span className="w-3.5 h-3.5 block border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= TAB 5: CR & ADMIN MANAGEMENT ================= */}
      {activeTab === "crs" && (
        <section className="space-y-4">
          <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 sm:p-5 rounded space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Class Representative & Admin Management</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  CR accounts have full access to manage tasks, resolve student complaints, and update class links.
                </p>
              </div>
              <div className="text-xs font-mono-numbers px-2.5 py-1 rounded border border-amber-300/60 dark:border-amber-900/40 bg-amber-500/10 text-amber-800 dark:text-amber-400 shrink-0">
                Primary Admin: psreyas09@gmail.com
              </div>
            </div>
          </div>

          {crError && (
            <div className="p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400">
              {crError}
            </div>
          )}

          {crMessage && (
            <div className="p-2.5 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-xs text-emerald-700 dark:text-emerald-400">
              {crMessage}
            </div>
          )}

          {/* Add CR Form - Primary Admin only */}
          {isPrimaryAdmin ? (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-4 sm:p-5 rounded space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono-numbers flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Add New Class Representative</span>
              </h3>
              <form onSubmit={handleAddCr} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  required
                  value={newCrEmail}
                  onChange={(e) => setNewCrEmail(e.target.value)}
                  placeholder="cr_college_email@domain.edu"
                  className="flex-1 px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={crLoading}
                  className="px-3.5 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60 shrink-0"
                >
                  {crLoading ? "Adding..." : "Add Representative"}
                </button>
              </form>
              <p className="text-[11px] text-zinc-400">
                Adding an email grants this person CR dashboard privileges immediately when they log in.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Only the Primary Admin (<strong>psreyas09@gmail.com</strong>) can add or remove Class Representatives.</span>
            </div>
          )}

          {/* Active Admins / CRs Table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono-numbers">
                <tr>
                  <th className="py-2.5 px-3">Account Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Assigned Date</th>
                  {isPrimaryAdmin && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {crList.map((admin) => {
                  const isPrimary = admin.email.toLowerCase() === "psreyas09@gmail.com" || admin.role === "primary";
                  return (
                    <tr key={admin.email} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <td className="py-2.5 px-3 font-mono-numbers font-medium text-zinc-900 dark:text-zinc-100">
                        {admin.email}
                      </td>
                      <td className="py-2.5 px-3">
                        {isPrimary ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-300/60 dark:border-amber-900/40">
                            <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Primary Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-numbers font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            Class Representative
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono-numbers text-zinc-500">
                        {formatKolkataShort(admin.created_at)}
                      </td>
                      {isPrimaryAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          {isPrimary ? (
                            <span className="text-[11px] text-zinc-400 italic">Protected</span>
                          ) : (
                            <button
                              type="button"
                              disabled={removingEmail === admin.email}
                              onClick={() => handleRemoveCr(admin.email)}
                              className="px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-600 hover:border-red-300 transition-colors"
                            >
                              {removingEmail === admin.email ? "Removing..." : "Remove CR"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= TAB 6: SETTINGS ================= */}
      {activeTab === "settings" && (
        <section className="max-w-xl space-y-4">
          <div className="border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-5 rounded space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Google Drive Resources Folder</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Updates the destination of the "Resources" button in the header and home page instantly for all students without redeploying.
              </p>
            </div>

            {settingsError && (
              <div className="p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400">
                {settingsError}
              </div>
            )}

            {settingsMessage && (
              <div className="p-2.5 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-xs text-emerald-700 dark:text-emerald-400">
                {settingsMessage}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Google Drive Folder URL
                </label>
                <input
                  type="url"
                  required
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={savedDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                >
                  <span>Test current link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
                >
                  {settingsLoading ? "Saving..." : "Save Drive Link"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Task Editor Dialog Modal */}
      <TaskEditorDialog
        key={editingTask ? editingTask.id : "new-task"}
        task={editingTask}
        isOpen={isTaskEditorOpen}
        onClose={() => {
          setIsTaskEditorOpen(false);
          setEditingTask(null);
        }}
        onSaved={handleTaskSaved}
      />

      {/* Reply to Complaint Modal */}
      <ReplyDialog
        key={replyingComplaint ? replyingComplaint.id : "none"}
        complaint={replyingComplaint}
        isOpen={!!replyingComplaint}
        onClose={() => setReplyingComplaint(null)}
        onSuccess={handleReplySuccess}
      />
    </div>
  );
}
