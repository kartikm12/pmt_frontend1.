import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Repeat } from "lucide-react";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { api } from "@/lib/api";
import { canonicalRepeat, describeRepeat, repeatTag, formatRepeat, parseRepeat, repeatPresets, WEEKDAYS, WEEKDAY_NAMES, type Freq, type RepeatRule } from "@/lib/repeat";

const CUSTOM = "__custom";
export const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// The next deadlines a rule gives, from the server (it owns the date maths); quiet on errors
export function useNextDates(rule: string, due: string) {
  const [next, setNext] = useState<string[]>([]);
  useEffect(() => {
    if (!rule) return setNext([]);
    let live = true;
    const t = setTimeout(() => {
      api.repeatPreview(rule, due).then((r) => live && setNext(r.next)).catch(() => live && setNext([]));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [rule, due]);
  return next;
}

// "↻ Weekly" on board cards and list rows; the full wording is in the tooltip
export function RepeatChip({ rule }: { rule?: string | null }) {
  const tag = repeatTag(rule);
  if (!tag) return null;
  return (
    <span data-repeat-chip title={describeRepeat(rule)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
      <Repeat className="w-3 h-3" aria-hidden="true" /> {tag}
    </span>
  );
}

// Task page side panel: "Every week on Wednesday" and, while the task is open, when the next one will be due
export function RepeatSummary({ task }: { task: { recurrence?: string | null; dueDate?: string | null; status: string } }) {
  const due = task.dueDate ? task.dueDate.slice(0, 10) : "";
  const rule = canonicalRepeat(task.recurrence, due);
  const open = task.status !== "Completed" && task.status !== "DONE";
  const next = useNextDates(open ? rule : "", due);
  return (
    <span className="text-right" data-repeat-summary>
      <span className="inline-flex items-center gap-1"><Repeat className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" /> {describeRepeat(rule)}</span>
      {open && next[0] && <span className="block text-xs text-slate-500 dark:text-slate-400">Next one due {fmtDay(next[0])}, once this is done</span>}
    </span>
  );
}

// Repeat field of the task form: quick choices worked out from the deadline, plus Custom…
export function RepeatPicker({ value, due, onChange }: { value: string; due: string; onChange: (rule: string) => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const current = canonicalRepeat(value, due);
  const presets = repeatPresets(due);
  const options = [
    { id: "", name: "Doesn't repeat" },
    ...presets,
    ...(current && !presets.some((p) => p.id === current) ? [{ id: current, name: describeRepeat(current) }] : []),
    { id: CUSTOM, name: "Custom…" }
  ];
  const next = useNextDates(current, due);
  return (
    <div className="space-y-2">
      <SingleSelectDropdown ariaLabel="Repeat" options={options} selectedId={current} searchable={false} onChange={(id) => (id === CUSTOM ? setCustomOpen(true) : onChange(id))} />
      {current && (
        <div data-repeat-explainer className="flex gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <Repeat className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              When this task is marked <b className="font-semibold">Done</b>, the next one appears
              {next[0] ? <>, due <b className="font-semibold" data-next-due>{fmtDay(next[0])}</b></> : ""}.
            </p>
            <p className="text-slate-500 dark:text-slate-400">Finished late? It skips ahead to the next date from today, so it never starts overdue.</p>
            <p className="text-slate-500 dark:text-slate-400">Copies the title, details, assignees, followers, labels, estimate and checklist (unticked). To stop, set “Doesn't repeat” on the latest one.</p>
          </div>
        </div>
      )}
      {customOpen && (
        <CustomRepeatDialog initial={current} due={due} onCancel={() => setCustomOpen(false)} onDone={(rule) => { setCustomOpen(false); onChange(rule); }} />
      )}
    </div>
  );
}

const UNITS: Array<{ freq: Freq; one: string; many: string }> = [
  { freq: "DAILY", one: "day", many: "days" },
  { freq: "WEEKLY", one: "week", many: "weeks" },
  { freq: "MONTHLY", one: "month", many: "months" },
  { freq: "YEARLY", one: "year", many: "years" }
];
const ORD: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth" };
type MonthMode = "day" | "nth" | "lastwd" | "lastday";
type Ends = "never" | "on" | "after";

function CustomRepeatDialog({ initial, due, onCancel, onDone }: { initial: string; due: string; onCancel: () => void; onDone: (rule: string) => void }) {
  const d = due ? new Date(`${due}T00:00:00Z`) : new Date();
  const wd = WEEKDAYS[(d.getUTCDay() + 6) % 7];
  const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const nth = Math.ceil(day / 7);
  const start = parseRepeat(initial);

  const [every, setEvery] = useState(String(start?.interval ?? 1));
  const [freq, setFreq] = useState<Freq>(start?.freq ?? "WEEKLY");
  const [days, setDays] = useState<string[]>(start?.freq === "WEEKLY" && start.byDay?.length ? start.byDay : [wd]);
  const [monthMode, setMonthMode] = useState<MonthMode>(
    start?.freq === "MONTHLY" ? (start.nth === -1 ? "lastwd" : start.nth ? "nth" : start.byMonthDay === -1 ? "lastday" : "day") : "day"
  );
  const [ends, setEnds] = useState<Ends>(start?.count ? "after" : start?.until ? "on" : "never");
  const [count, setCount] = useState(String(start?.count ?? 5));
  const [until, setUntil] = useState(start?.until ? `${start.until.slice(0, 4)}-${start.until.slice(4, 6)}-${start.until.slice(6)}` : "");

  const monthOptions: Array<{ id: MonthMode; label: string }> = [
    { id: "day", label: `Day ${day} of the month${day >= 29 ? " (the last day in shorter months)" : ""}` },
    ...(nth <= 4 ? [{ id: "nth" as const, label: `The ${ORD[nth]} ${WEEKDAY_NAMES[wd]}` }] : []),
    ...(day + 7 > lastDay ? [{ id: "lastwd" as const, label: `The last ${WEEKDAY_NAMES[wd]}` }] : []),
    { id: "lastday", label: "The last day of the month" }
  ];

  const n = Number(every);
  const problem =
    !Number.isInteger(n) || n < 1 || n > 99 ? "Repeat every 1 to 99." :
    freq === "WEEKLY" && !days.length ? "Pick at least one day." :
    ends === "after" && !(Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 500) ? "End after 1 to 500 times." :
    ends === "on" && (!until || (due && until < due)) ? "Pick an end date on or after the deadline." : "";

  const rule: RepeatRule = { freq, interval: n || 1 };
  if (freq === "WEEKLY") rule.byDay = days;
  if (freq === "MONTHLY") {
    if (monthMode === "day") rule.byMonthDay = day;
    if (monthMode === "lastday") rule.byMonthDay = -1;
    if (monthMode === "nth") { rule.nth = nth; rule.byDay = [wd]; }
    if (monthMode === "lastwd") { rule.nth = -1; rule.byDay = [wd]; }
  }
  if (freq === "YEARLY") { rule.byMonth = d.getUTCMonth() + 1; rule.byMonthDay = day; }
  if (ends === "after") rule.count = Number(count);
  if (ends === "on" && until) rule.until = until.replace(/-/g, "");
  const ruleText = problem ? "" : formatRepeat(rule);
  const next = useNextDates(ruleText, due);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const unitName = (u: (typeof UNITS)[number]) => (n === 1 ? u.one : u.many);
  const radio = "w-4 h-4 accent-indigo-600";

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-950/50 flex items-center justify-center p-3" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label="Custom repeat" className="card w-full max-w-md p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom repeat</h3>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Repeat every</p>
          <div className="flex gap-2">
            <input type="number" min={1} max={99} value={every} onChange={(e) => setEvery(e.target.value)} aria-label="Repeat every how many" className="input w-20 px-3 py-2 text-sm dark:text-slate-100" />
            <div className="w-40">
              <SingleSelectDropdown ariaLabel="Repeat unit" searchable={false} options={UNITS.map((u) => ({ id: u.freq, name: unitName(u) }))} selectedId={freq} onChange={(f) => setFreq(f as Freq)} />
            </div>
          </div>
        </div>

        {freq === "WEEKLY" && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">On these days</p>
            <div className="flex gap-1.5" role="group" aria-label="Days of the week">
              {WEEKDAYS.map((w) => {
                const on = days.includes(w);
                return (
                  <button key={w} type="button" aria-pressed={on} aria-label={WEEKDAY_NAMES[w]} title={WEEKDAY_NAMES[w]}
                    onClick={() => setDays(on ? days.filter((x) => x !== w) : [...days, w])}
                    className={`w-9 h-9 rounded-full text-xs font-bold border ${on ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    {WEEKDAY_NAMES[w][0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {freq === "MONTHLY" && (
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">On</legend>
            {monthOptions.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input type="radio" name="month-mode" className={radio} checked={monthMode === o.id} onChange={() => setMonthMode(o.id)} />
                {o.label}
              </label>
            ))}
          </fieldset>
        )}

        {freq === "YEARLY" && (
          <p className="text-sm text-slate-600 dark:text-slate-300">On {d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}{day === 29 && d.getUTCMonth() === 1 ? " (28 February in other years)" : ""}.</p>
        )}

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Ends</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="radio" name="ends" className={radio} checked={ends === "never"} onChange={() => setEnds("never")} /> Never
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="radio" name="ends" className={radio} checked={ends === "on"} onChange={() => setEnds("on")} /> On
            <input type="date" value={until} min={due || undefined} onFocus={() => setEnds("on")} onChange={(e) => { setUntil(e.target.value); setEnds("on"); }} aria-label="End date" className="input px-2 py-1 text-sm dark:text-slate-100" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="radio" name="ends" className={radio} checked={ends === "after"} onChange={() => setEnds("after")} /> After
            <input type="number" min={1} max={500} value={count} onFocus={() => setEnds("after")} onChange={(e) => { setCount(e.target.value); setEnds("after"); }} aria-label="Number of times" className="input w-20 px-2 py-1 text-sm dark:text-slate-100" />
            times <span className="text-xs text-slate-400">(counting this one)</span>
          </label>
        </fieldset>

        <div className="flex gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-sm" data-custom-summary>
          <Repeat className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" aria-hidden="true" />
          {problem ? (
            <p className="text-red-600 dark:text-red-400 font-semibold">{problem}</p>
          ) : (
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{describeRepeat(ruleText)}.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {next.length ? `Next ones: ${next.map(fmtDay).join(", ")}${rule.count && rule.count - 1 > next.length ? "…" : ""}` : rule.count === 1 ? "No more after this one." : "Working out the dates…"}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary px-4 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={() => !problem && onDone(ruleText)} aria-disabled={!!problem} className={`btn-primary px-4 py-2 text-sm font-bold ${problem ? "opacity-60 cursor-not-allowed" : ""}`}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

