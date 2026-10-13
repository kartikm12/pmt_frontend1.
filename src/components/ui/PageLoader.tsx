// Shown while a page's code downloads: a calm outline of a page instead of a blank screen
export function PageLoader() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Loading page…</span>
      <div className="h-8 w-56 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-80 max-w-full rounded bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
    </div>
  );
}
