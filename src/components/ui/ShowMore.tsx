import { useEffect, useState } from "react";

/**
 * Long lists show one page at a time. `resetKey` is anything that should send the list back to its first
 * page (a search, a filter): when it changes, only the first page shows again.
 */
export function useShowMore<T = any>(items: T[], pageSize: number, resetKey: string = ""): { shown: T[]; left: number; more: () => void } {
  const [count, setCount] = useState(pageSize);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);
  const shown = items.length > count ? items.slice(0, count) : items;
  return { shown, left: items.length - shown.length, more: () => setCount((c) => c + pageSize) };
}

/** The "Show more (N left)" button; shows nothing when everything is already on screen. */
export function ShowMore({ left, onMore, className = "" }: { left: number; onMore: () => void; className?: string }) {
  if (left <= 0) return null;
  return (
    <div className={`py-4 text-center ${className}`}>
      <button type="button" onClick={onMore} className="btn-secondary px-4 py-2 text-sm">
        Show more ({left} left)
      </button>
    </div>
  );
}
