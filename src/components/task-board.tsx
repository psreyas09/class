"use client";

import { useState, useMemo } from "react";
import { Task } from "@/lib/types";
import { TaskItem } from "@/components/task-item";
import { TaskFilters } from "@/components/task-filters";
import { FolderOpen, ExternalLink, Calendar, CheckCircle2 } from "lucide-react";

interface TaskBoardProps {
  initialTasks: Task[];
  driveUrl: string;
  isAdmin: boolean;
}

export function TaskBoard({ initialTasks, driveUrl, isAdmin }: TaskBoardProps) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");

  // Distinct list of subjects
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    initialTasks.forEach((t) => {
      if (t.subject) set.add(t.subject.trim());
    });
    return Array.from(set).sort();
  }, [initialTasks]);

  // Filter & sort tasks
  const filteredTasks = useMemo(() => {
    return initialTasks.filter((task) => {
      // Type filter
      if (selectedType !== "All" && task.type !== selectedType) {
        return false;
      }
      // Subject filter
      if (selectedSubject !== "All" && task.subject !== selectedSubject) {
        return false;
      }
      // Keyword search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesSubject = task.subject.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesSubject && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [initialTasks, selectedType, selectedSubject, search]);

  const overdueCount = useMemo(() => {
    const now = new Date().getTime();
    return initialTasks.filter((t) => new Date(t.due_at).getTime() < now).length;
  }, [initialTasks]);

  return (
    <div className="space-y-6">
      {/* Prominent Resources Banner */}
      <section className="border border-amber-300/80 dark:border-amber-900/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded border border-amber-300 dark:border-amber-800 bg-amber-500/15 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Class Google Drive</span>
              <span className="text-[10px] font-mono-numbers text-amber-700 dark:text-amber-400 font-normal px-1.5 py-0.2 rounded border border-amber-300/60 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40">
                Official
              </span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Lab records, answer keys, textbooks, and past papers live in Drive.
            </p>
          </div>
        </div>

        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-zinc-950 transition-colors shadow-xs shrink-0 w-full sm:w-auto justify-center"
        >
          <span>Open Resources</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* Auto-Removal Rule Notice for Students */}
      {overdueCount > 0 && (
        <div className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {overdueCount} {overdueCount === 1 ? "task is" : "tasks are"} past deadline. Expired tasks vanish automatically 4 days after due date.
            </span>
          </span>
          {isAdmin && (
            <a
              href="/admin?tab=archive"
              className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0"
            >
              View Archive →
            </a>
          )}
        </div>
      )}

      {/* Filter Controls */}
      <section aria-label="Task Filters">
        <TaskFilters
          search={search}
          onSearchChange={setSearch}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedSubject={selectedSubject}
          onSubjectChange={setSelectedSubject}
          availableSubjects={availableSubjects}
        />
      </section>

      {/* Tasks List */}
      <section aria-label="Active Tasks List">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono-numbers uppercase tracking-wider">
            Active Work ({filteredTasks.length})
          </h3>
          <span className="text-[11px] text-zinc-500">
            Sorted by nearest due date
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded">
            <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 mx-auto flex items-center justify-center text-zinc-400 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {initialTasks.length === 0
                ? "Nothing due right now"
                : "No matching tasks found"}
            </h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {initialTasks.length === 0
                ? "All caught up! Check the Resources button above for older study material and lecture notes."
                : "Try clearing your search query or subject filters to see other active assignments."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
