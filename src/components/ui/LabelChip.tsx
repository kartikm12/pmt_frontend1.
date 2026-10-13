import React, { useState } from "react";
import { X } from "lucide-react";

// A label keeps the same colour everywhere: picked from its name
const PALETTE = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300"
];

function colorFor(label: string) {
  let h = 0;
  for (const ch of label.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void; key?: React.Key }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${colorFor(label)}`}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove label ${label}`} className="hover:opacity-70">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// Type a label and press Enter or comma; up to 10, lower-cased, no duplicates
export function LabelInput({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim().toLowerCase().slice(0, 30);
    if (value && !labels.includes(value) && labels.length < 10) onChange([...labels, value]);
    setDraft("");
  };
  return (
    <div className="w-full input px-2 py-1.5 flex flex-wrap items-center gap-1.5 min-h-[42px]">
      {labels.map((l) => (
        <LabelChip key={l} label={l} onRemove={() => onChange(labels.filter((x) => x !== l))} />
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && labels.length) {
            onChange(labels.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={labels.length ? "" : "bug, client, design…"}
        aria-label="Add a label"
        className="flex-1 min-w-[80px] bg-transparent text-sm outline-none dark:text-slate-100"
      />
    </div>
  );
}
