"use client";

import { useEffect, useState } from "react";
import { Task, TaskType } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { kolkataLocalToUTC, utcToKolkataLocalInput } from "@/lib/date-utils";
import { X, Calendar, Link as LinkIcon } from "lucide-react";

interface TaskEditorDialogProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (task: Task, isNew: boolean) => void;
}

const TASK_TYPES: TaskType[] = [
  "Assignment",
  "Record",
  "Reference Record",
  "Form",
  "Other",
];

export function TaskEditorDialog({
  task,
  isOpen,
  onClose,
  onSaved,
}: TaskEditorDialogProps) {
  const isEditing = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [type, setType] = useState<TaskType>(task?.type || "Assignment");
  const [subject, setSubject] = useState(task?.subject || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueAtLocal, setDueAtLocal] = useState(
    task?.due_at ? utcToKolkataLocalInput(task.due_at) : ""
  );
  const [link, setLink] = useState(task?.link || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever editing task changes or modal opens
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setType(task.type || "Assignment");
      setSubject(task.subject || "");
      setDescription(task.description || "");
      setDueAtLocal(task.due_at ? utcToKolkataLocalInput(task.due_at) : "");
      setLink(task.link || "");
    } else {
      setTitle("");
      setType("Assignment");
      setSubject("");
      setDescription("");
      setDueAtLocal("");
      setLink("");
    }
    setError(null);
  }, [task, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedSubject = subject.trim() || "General";
    const trimmedLink = link.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle || trimmedTitle.length > 150) {
      setError("Title is required and must be 150 characters or less.");
      return;
    }
    if (trimmedSubject.length > 60) {
      setError("Subject must be 60 characters or less.");
      return;
    }
    if (!dueAtLocal) {
      setError("Please choose a due date and time.");
      return;
    }
    if (trimmedDesc.length > 2000) {
      setError("Description must be 2000 characters or less.");
      return;
    }
    if (trimmedLink && !trimmedLink.startsWith("http://") && !trimmedLink.startsWith("https://")) {
      setError("Link must begin with http:// or https://");
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const dueAtUTC = kolkataLocalToUTC(dueAtLocal);

      if (isEditing) {
        const { data, error: updateError } = await supabase
          .from("tasks")
          .update({
            title: trimmedTitle,
            type,
            subject: trimmedSubject,
            description: trimmedDesc || null,
            due_at: dueAtUTC,
            link: trimmedLink || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id)
          .select()
          .single();

        if (updateError) {
          setError(updateError.message);
          setLoading(false);
          return;
        }

        // Trigger notification broadcast for the task modification
        fetch("/api/tasks/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            type,
            subject: trimmedSubject,
            description: trimmedDesc,
            due_at: dueAtUTC,
            link: trimmedLink,
            isUpdate: true,
          }),
        }).catch((err) =>
          console.warn("Task update notification broadcast failed:", err)
        );

        onSaved(data as Task, false);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data, error: insertError } = await supabase
          .from("tasks")
          .insert({
            title: trimmedTitle,
            type,
            subject: trimmedSubject,
            description: trimmedDesc || null,
            due_at: dueAtUTC,
            link: trimmedLink || null,
            is_archived: false,
            created_by: user?.id,
          })
          .select()
          .single();

        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }

        // Trigger notification broadcast asynchronously (Email via Resend & Web Push)
        fetch("/api/tasks/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            type,
            subject: trimmedSubject,
            description: trimmedDesc,
            due_at: dueAtUTC,
            link: trimmedLink,
            isUpdate: false,
          }),
        }).catch((err) =>
          console.warn("Task notification broadcast failed:", err)
        );

        onSaved(data as Task, true);
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] p-5 sm:p-6 rounded shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3 mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isEditing ? "Edit Task" : "Create New Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Task Title{" "}
              <span className="text-[10px] text-zinc-400 font-mono-numbers">
                ({title.length}/150)
              </span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lab Experiment 4: Norton Theorem"
              className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 cursor-pointer"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Subject Code / Name{" "}
                <span className="text-[10px] text-zinc-400 font-normal">
                  (Optional • defaults to General)
                </span>
              </label>
              <input
                type="text"
                maxLength={60}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. CS302 or leave blank for General"
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
              <span>Due Date & Time</span>
              <span className="text-[10px] text-zinc-400 font-mono-numbers">
                Asia/Kolkata (IST)
              </span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                required
                value={dueAtLocal}
                onChange={(e) => setDueAtLocal(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono-numbers focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              External Link (Optional)
            </label>
            <div className="relative">
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://forms.google.com/... or submission portal"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
              />
              <LinkIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description / Instructions (Optional){" "}
              <span className="text-[10px] text-zinc-400 font-mono-numbers">
                ({description.length}/2000)
              </span>
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Formatting rules, graph paper requirement, submission format..."
              className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
