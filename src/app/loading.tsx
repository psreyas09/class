export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] animate-pulse">
      {/* Skeleton Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-[var(--background)]/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-20 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-7 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </header>

      {/* Skeleton Main Board */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12 space-y-4">
        {/* Title bar */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="w-32 h-5 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-48 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="w-28 h-8 rounded bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
        </div>

        {/* Filters shell */}
        <div className="flex gap-2 pt-2">
          <div className="w-48 h-8 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-24 h-8 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-24 h-8 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Task Cards Skeleton */}
        <div className="space-y-2.5 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded border border-zinc-200 dark:border-zinc-800 bg-[var(--card)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-24 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="w-16 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="w-3/4 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="w-1/2 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
