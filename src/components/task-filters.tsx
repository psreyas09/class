"use client";

import { TaskType } from "@/lib/types";
import { Search, Filter, X } from "lucide-react";

interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedSubject: string;
  onSubjectChange: (value: string) => void;
  availableSubjects: string[];
}

const TASK_TYPES: (TaskType | "All")[] = [
  "All",
  "Assignment",
  "Record",
  "Reference Record",
  "Form",
  "Other",
];

export function TaskFilters({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedSubject,
  onSubjectChange,
  availableSubjects,
}: TaskFiltersProps) {
  const hasActiveFilters =
    search.trim() !== "" || selectedType !== "All" || selectedSubject !== "All";

  function clearFilters() {
    onSearchChange("");
    onTypeChange("All");
    onSubjectChange("All");
  }

  return (
    <div className="space-y-2.5">
      {/* Top Search bar & Subject dropdown */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assignments, records, subjects..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2 pointer-events-none" />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Subject Filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs text-zinc-500 hidden sm:inline">Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-600 dark:focus:border-amber-500 transition-colors cursor-pointer"
          >
            <option value="All">All Subjects</option>
            {availableSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[11px] text-zinc-400 mr-1 hidden sm:inline flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Type:
        </span>
        {TASK_TYPES.map((type) => {
          const isActive = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(type)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                  : "border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              {type}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5 shrink-0 px-1"
          >
            <X className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
