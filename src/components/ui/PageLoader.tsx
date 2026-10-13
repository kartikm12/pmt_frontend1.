// The one loading indicator for the whole app: first start, opening a page, and every page's first data load.
// `compact` is the same loader sized for a panel inside a page; `fullScreen` covers the window (app start).
export function PageLoader({ compact = false, fullScreen = false }: { compact?: boolean; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-page-loader
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 ${
        fullScreen ? "min-h-screen bg-slate-50 dark:bg-slate-950" : compact ? "py-10" : "min-h-[50vh]"
      }`}
    >
      <span className={`relative ${compact ? "w-7 h-7" : "w-10 h-10"}`} aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50" />
        <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
      </span>
      <span className="text-sm font-medium">Loading…</span>
    </div>
  );
}
