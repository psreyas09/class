"use client";

import { useState } from "react";
import { Task } from "@/lib/types";
import { formatKolkataDateTime, getDueCountdown } from "@/lib/date-utils";
import { ExternalLink, ChevronDown, ChevronUp, AlertCircle, Clock } from "lucide-react";

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const countdown = getDueCountdown(task.due_at);
  const formattedDate = formatKolkataDateTime(task.due_at);

  return (
    <article
      className={`group border border-zinc-200 dark:border-zinc-800 rounded transition-all ${
        countdown.isOverdue
          ? "bg-zinc-50/60 dark:bg-zinc-900/30 opacity-75 hover:opacity-100"
          : "bg-[var(--card)] hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Type Tag, Subject Tag, Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Type badge */}
            <span className="px-1.5 py-0.5 text-[10px] font-medium font-mono-numbers rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {task.type}
            </span>

            {/* Subject badge */}
            <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase font-mono-numbers rounded bg-zinc-200/50 dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200">
              {task.subject}
            </span>

            {/* Overdue Warning Badge */}
            {countdown.isOverdue && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono-numbers rounded border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>{countdown.vanishWarning}</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {task.title}
          </h2>

          {/* Due date timestamp */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 font-mono-numbers">
            <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
            <span>Due {formattedDate}</span>
          </div>
        </div>

        {/* Right Side: Countdown and Action Links */}
        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/60">
          {/* Due countdown */}
          <span
            className={`font-mono-numbers text-xs font-semibold px-2 py-0.5 rounded border ${
              countdown.isOverdue
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-900/40"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {countdown.label}
          </span>

          <div className="flex items-center gap-2">
            {/* External link if provided */}
            {task.link && (
              <a
                href={task.link}
                target="_blank"
                rel="noopener noreferrer"
                title="Open attached resource"
                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
              >
                <span>Open Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Description toggle */}
            {task.description && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                aria-expanded={expanded}
              >
                <span>{expanded ? "Less" : "Details"}</span>
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Description */}
      {expanded && task.description && (
        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
          {task.description}
        </div>
      )}
    </article>
  );
}
