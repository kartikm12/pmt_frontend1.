import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Edit2, Loader2, Plus, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { BoardColumn, ProjectRule, RuleActionType, RuleTrigger } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSocket } from "@/context/SocketContext";

type Person = { id: string; name: string };
type CondType = "PRIORITY" | "LABEL" | "ASSIGNEE";
type Draft = {
  trigger: RuleTrigger;
  triggerValue: string;
  conditions: { type: CondType; priorities: string[]; value: string }[];
  actions: { type: RuleActionType; value: string }[];
  enabled: boolean;
};

const TRIGGERS: { id: RuleTrigger; name: string }[] = [
  { id: "MOVED_TO_COLUMN", name: "A task moves to a column" },
  { id: "TASK_CREATED", name: "A task is created" },
  { id: "ASSIGNED", name: "Someone is assigned" },
  { id: "DUE_TOMORROW", name: "A task is due tomorrow" },
  { id: "OVERDUE", name: "A task is overdue" }
];
const CONDITIONS: { id: CondType; name: string }[] = [
  { id: "PRIORITY", name: "Priority is" },
  { id: "LABEL", name: "Has the label" },
  { id: "ASSIGNEE", name: "Assigned to" }
];
const ACTIONS: { id: RuleActionType; name: string }[] = [
  { id: "ASSIGN", name: "Assign to" },
  { id: "NOTIFY", name: "Notify" },
  { id: "MOVE_TO_COLUMN", name: "Move to column" },
  { id: "SET_PRIORITY", name: "Set priority" },
  { id: "ADD_LABEL", name: "Add label" },
  { id: "ADD_WATCHER", name: "Add as watcher" }
];
const PRIORITIES = [{ id: "LOW", name: "Low" }, { id: "MEDIUM", name: "Medium" }, { id: "HIGH", name: "High" }, { id: "URGENT", name: "Urgent" }];
const GROUPS = [{ id: "PROJECT_MANAGERS", name: "The project managers" }, { id: "ASSIGNEES", name: "The task's assignees" }];

const emptyDraft = (): Draft => ({ trigger: "MOVED_TO_COLUMN", triggerValue: "", conditions: [], actions: [{ type: "ASSIGN", value: "" }], enabled: true });

const listWords = (parts: string[], joiner = "and") => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${joiner} ${parts[parts.length - 1]}`);

// The rule as one plain sentence, plus whether it points at a column or person that's gone
export function describeRule(rule: Pick<ProjectRule, "trigger" | "triggerValue" | "conditions" | "actions">, columns: BoardColumn[], people: Person[]) {
  let broken = false;
  const col = (id?: string | null) => {
    const c = columns.find((x) => x.id === id);
    if (!c) broken = true;
    return c?.name ?? "a removed column";
  };
  const who = (id?: string | null) => {
    const p = people.find((x) => x.id === id);
    if (!p) broken = true;
    return p?.name ?? "someone no longer on the team";
  };
  const pri = (id: string) => PRIORITIES.find((p) => p.id === id)?.name ?? id;
  const when = {
    TASK_CREATED: "When a task is created",
    MOVED_TO_COLUMN: `When a task moves to ${col(rule.triggerValue)}`,
    ASSIGNED: rule.triggerValue ? `When ${who(rule.triggerValue)} is assigned` : "When someone is assigned",
    DUE_TOMORROW: "When a task is due tomorrow",
    OVERDUE: `When a task is ${rule.triggerValue} day${rule.triggerValue === "1" ? "" : "s"} overdue`
  }[rule.trigger];
  const ifs: string[] = [];
  if (rule.conditions?.priorities?.length) ifs.push(`priority is ${listWords(rule.conditions.priorities.map(pri), "or")}`);
  if (rule.conditions?.label) ifs.push(`it has the label ${rule.conditions.label}`);
  if (rule.conditions?.assigneeId) ifs.push(`it's assigned to ${who(rule.conditions.assigneeId)}`);
  const thens = rule.actions.map((a) => {
    switch (a.type) {
      case "ASSIGN": return `assign ${who(a.value)}`;
      case "ADD_WATCHER": return `add ${who(a.value)} as a watcher`;
      case "MOVE_TO_COLUMN": return `move it to ${col(a.value)}`;
      case "SET_PRIORITY": return `set priority to ${pri(a.value)}`;
      case "ADD_LABEL": return `add the label ${a.value}`;
      case "NOTIFY": return a.value === "PROJECT_MANAGERS" ? "tell the project managers" : a.value === "ASSIGNEES" ? "tell the assignees" : `tell ${who(a.value)}`;
      default: return a.type;
    }
  });
  return { text: `${when}${ifs.length ? `, if ${listWords(ifs)}` : ""}, then ${listWords(thens)}.`, broken };
}

function toDraft(rule: ProjectRule): Draft {
  const conditions: Draft["conditions"] = [];
  if (rule.conditions?.priorities?.length) conditions.push({ type: "PRIORITY", priorities: rule.conditions.priorities, value: "" });
  if (rule.conditions?.label) conditions.push({ type: "LABEL", priorities: [], value: rule.conditions.label });
  if (rule.conditions?.assigneeId) conditions.push({ type: "ASSIGNEE", priorities: [], value: rule.conditions.assigneeId });
  return { trigger: rule.trigger, triggerValue: rule.triggerValue ?? "", conditions, actions: rule.actions.map((a) => ({ ...a })), enabled: rule.enabled };
}

function fromDraft(d: Draft) {
  const conditions: ProjectRule["conditions"] = {};
  for (const c of d.conditions) {
    if (c.type === "PRIORITY") conditions.priorities = c.priorities;
    if (c.type === "LABEL") conditions.label = c.value.trim();
    if (c.type === "ASSIGNEE") conditions.assigneeId = c.value;
  }
  const triggerValue = d.trigger === "MOVED_TO_COLUMN" || d.trigger === "OVERDUE" || (d.trigger === "ASSIGNED" && d.triggerValue) ? d.triggerValue.trim() : null;
  return { enabled: d.enabled, trigger: d.trigger, triggerValue, conditions, actions: d.actions.map((a) => ({ type: a.type, value: a.value.trim() })) };
}

// What's missing before the rule can be saved (same rules as the server, said in plain words)
function draftProblem(d: Draft) {
  if (d.trigger === "MOVED_TO_COLUMN" && !d.triggerValue) return "Pick the column under When.";
  if (d.trigger === "OVERDUE") {
    const n = Number(d.triggerValue);
    if (!Number.isInteger(n) || n < 1 || n > 60) return "Overdue days must be a whole number from 1 to 60.";
  }
  for (const c of d.conditions) {
    if (c.type === "PRIORITY" && !c.priorities.length) return "Pick at least one priority under Only if.";
    if (c.type !== "PRIORITY" && !c.value.trim()) return c.type === "LABEL" ? "Type the label under Only if." : "Pick the person under Only if.";
    if (c.type === "LABEL" && c.value.trim().length > 30) return "Labels are up to 30 characters.";
  }
  if (!d.actions.length) return "Add at least one action under Then.";
  for (const a of d.actions) {
    if (!a.value.trim()) return "Every action under Then needs a choice.";
    if (a.type === "ADD_LABEL" && a.value.trim().length > 30) return "Labels are up to 30 characters.";
  }
  return "";
}

interface Props {
  projectId: string;
  columns: BoardColumn[];
  people: Person[];
  canManage: boolean;
  closed: boolean;
}

export function ProjectRules({ projectId, columns, people, canManage, closed }: Props) {
  const { socket } = useSocket();
  const [rules, setRules] = useState<ProjectRule[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [tried, setTried] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectRule | null>(null);

  const load = useCallback(async () => {
    try {
      setRules(await api.getRules(projectId));
      setLoadError("");
    } catch (e: any) {
      setLoadError(e?.message || "Couldn't load the rules");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Someone else changed the rules (or a rule ran and its count moved)
  useEffect(() => {
    if (!socket) return;
    const refresh = (data: { projectId?: string }) => data?.projectId === projectId && void load();
    socket.on("rules_updated", refresh);
    socket.on("task_updated", refresh);
    return () => {
      socket.off("rules_updated", refresh);
      socket.off("task_updated", refresh);
    };
  }, [socket, projectId, load]);

  const editable = canManage && !closed;
  const startNew = () => {
    setEditing({ draft: emptyDraft() });
    setTried(false);
    setSaveError("");
  };
  const startEdit = (rule: ProjectRule) => {
    setEditing({ id: rule.id, draft: toDraft(rule) });
    setTried(false);
    setSaveError("");
  };

  const save = async () => {
    if (!editing) return;
    setTried(true);
    if (draftProblem(editing.draft) || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.saveRule(projectId, fromDraft(editing.draft), editing.id);
      toast.success(editing.id ? "Rule saved" : "Rule added");
      setEditing(null);
      await load();
    } catch (e: any) {
      setSaveError(e?.message || "Couldn't save the rule. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule: ProjectRule) => {
    setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)) ?? prev);
    try {
      await api.setRuleEnabled(projectId, rule.id, !rule.enabled);
      toast.success(rule.enabled ? "Rule switched off" : "Rule switched on");
    } catch (e: any) {
      setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)) ?? prev);
      toast.error(e?.message || "Couldn't change the rule");
    }
  };

  const remove = async () => {
    const rule = toDelete;
    setToDelete(null);
    if (!rule) return;
    try {
      await api.deleteRule(projectId, rule.id);
      setRules((prev) => prev?.filter((r) => r.id !== rule.id) ?? prev);
      toast.success("Rule removed");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't remove the rule");
    }
  };

  if (loadError) return <div role="alert" className="card p-6 text-sm font-semibold text-red-600">{loadError}</div>;
  if (!rules) return <div className="card p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6" data-rules-tab>
      <div className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rules</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {editable ? "Let the board do routine steps for you: when something happens to a task, PMT does what you set." : closed ? "This project is closed, so its rules don't run and can't be changed." : "Project managers set these up. They run on their own when tasks change."}
            </p>
          </div>
          {editable && !editing && (
            <button type="button" onClick={startNew} className="btn-primary px-4 py-2.5 text-sm font-bold inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> New rule
            </button>
          )}
        </div>

        {rules.length === 0 ? (
          <div className="py-8 text-center">
            <Zap className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">No rules yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">For example: when a task moves to Review, assign the lead and tell the project managers.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
            {rules.map((rule) => {
              const { text, broken } = describeRule(rule, columns, people);
              return (
                <li key={rule.id} data-rule={rule.id} className="py-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${rule.enabled ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>{text}</p>
                    {broken && (
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-1 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> It names a column or person that's gone{editable ? ". Edit it to choose again." : "."}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap" data-rule-runs>
                    {rule.runCount ? `ran ${rule.runCount} time${rule.runCount === 1 ? "" : "s"}` : "never ran"}
                  </span>
                  {editable ? (
                    <>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.enabled}
                        aria-label={`${rule.enabled ? "Switch off" : "Switch on"}: ${text}`}
                        onClick={() => void toggle(rule)}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${rule.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${rule.enabled ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                      <button type="button" onClick={() => startEdit(rule)} aria-label={`Edit rule: ${text}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setToDelete(rule)} aria-label={`Remove rule: ${text}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${rule.enabled ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                      {rule.enabled ? "On" : "Off"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <RuleEditor
          draft={editing.draft}
          isNew={!editing.id}
          onChange={(draft) => setEditing({ ...editing, draft })}
          columns={columns}
          people={people}
          problem={tried ? draftProblem(editing.draft) : ""}
          error={saveError}
          saving={saving}
          onSave={() => void save()}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this rule?"
        message={toDelete ? describeRule(toDelete, columns, people).text : undefined}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function RuleEditor({ draft, isNew, onChange, columns, people, problem, error, saving, onSave, onCancel }: {
  draft: Draft;
  isNew: boolean;
  onChange: (d: Draft) => void;
  columns: BoardColumn[];
  people: Person[];
  problem: string;
  error: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const label = "text-xs font-semibold text-slate-500 dark:text-slate-400";
  const columnOptions = columns.filter((c) => !c.id.startsWith("stage:")).map((c) => ({ id: c.id, name: c.name }));
  const personOptions = people.map((p) => ({ id: p.id, name: p.name }));
  const usedConds = new Set(draft.conditions.map((c) => c.type));
  const preview = describeRule(fromDraft(draft) as ProjectRule, columns, people).text;
  const complete = !problem && !draftProblem(draft);

  const valueField = (type: RuleActionType, value: string, set: (v: string) => void, i: number) => {
    const aria = `Action ${i + 1} choice`;
    if (type === "ASSIGN" || type === "ADD_WATCHER") return <SingleSelectDropdown ariaLabel={aria} searchPlaceholder="Search people..." placeholder="Pick a person..." options={personOptions} selectedId={value} onChange={set} />;
    if (type === "NOTIFY") return <SingleSelectDropdown ariaLabel={aria} searchPlaceholder="Search people..." placeholder="Who to tell..." options={[...GROUPS, ...personOptions]} selectedId={value} onChange={set} />;
    if (type === "MOVE_TO_COLUMN") return <SingleSelectDropdown ariaLabel={aria} searchPlaceholder="Search columns..." placeholder="Pick a column..." options={columnOptions} selectedId={value} onChange={set} />;
    if (type === "SET_PRIORITY") return <SingleSelectDropdown ariaLabel={aria} searchPlaceholder="Search priorities..." placeholder="Pick a priority..." options={PRIORITIES} selectedId={value} onChange={set} />;
    return <input aria-label={aria} value={value} maxLength={30} onChange={(e) => set(e.target.value)} placeholder="urgent-fix" className="w-full px-3 py-2.5 input text-sm dark:text-slate-100" />;
  };

  return (
    <div className="card p-4 sm:p-6 max-w-2xl" data-rule-editor>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{isNew ? "New rule" : "Edit rule"}</h3>
        <button type="button" onClick={onCancel} aria-label="Close rule editor" className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
      </div>

      <p className={label}>When</p>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px] gap-2 mt-1 mb-4">
        <SingleSelectDropdown
          ariaLabel="When"
          searchPlaceholder="Search events..."
          options={TRIGGERS}
          selectedId={draft.trigger}
          onChange={(t) => onChange({ ...draft, trigger: t as RuleTrigger, triggerValue: t === "OVERDUE" ? "2" : "" })}
        />
        {draft.trigger === "MOVED_TO_COLUMN" && (
          <SingleSelectDropdown ariaLabel="Which column" searchPlaceholder="Search columns..." placeholder="Pick a column..." options={columnOptions} selectedId={draft.triggerValue} onChange={(v) => onChange({ ...draft, triggerValue: v })} />
        )}
        {draft.trigger === "ASSIGNED" && (
          <SingleSelectDropdown ariaLabel="Who is assigned" searchPlaceholder="Search people..." options={[{ id: "", name: "Anyone" }, ...personOptions]} selectedId={draft.triggerValue} onChange={(v) => onChange({ ...draft, triggerValue: v })} />
        )}
        {draft.trigger === "OVERDUE" && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>by</span>
            <input type="number" inputMode="numeric" min={1} max={60} aria-label="Days overdue" value={draft.triggerValue} onChange={(e) => onChange({ ...draft, triggerValue: e.target.value })} className="w-20 px-3 py-2.5 input text-sm dark:text-slate-100" />
            <span>days</span>
          </label>
        )}
      </div>

      <p className={label}>Only if <span className="font-normal text-slate-400">(optional)</span></p>
      <div className="space-y-2 mt-1 mb-2">
        {draft.conditions.map((c, i) => (
          <div key={c.type} className="grid grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[180px_minmax(0,1fr)_36px] gap-2 items-start">
            <SingleSelectDropdown
              ariaLabel={`Condition ${i + 1}`}
              searchPlaceholder="Search conditions..."
              options={CONDITIONS.filter((o) => o.id === c.type || !usedConds.has(o.id))}
              selectedId={c.type}
              onChange={(t) => onChange({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { type: t as CondType, priorities: [], value: "" } : x)) })}
            />
            <div className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto">
              {c.type === "PRIORITY" ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Priorities">
                  {PRIORITIES.map((p) => {
                    const on = c.priorities.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, priorities: on ? x.priorities.filter((q) => q !== p.id) : [...x.priorities, p.id] } : x)) })}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border ${on ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              ) : c.type === "LABEL" ? (
                <input aria-label="Label" value={c.value} maxLength={30} placeholder="bug" onChange={(e) => onChange({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className="w-full px-3 py-2.5 input text-sm dark:text-slate-100" />
              ) : (
                <SingleSelectDropdown ariaLabel="Assigned to" searchPlaceholder="Search people..." placeholder="Pick a person..." options={personOptions} selectedId={c.value} onChange={(v) => onChange({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
              )}
            </div>
            <button type="button" aria-label={`Remove condition ${i + 1}`} onClick={() => onChange({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })} className="w-9 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 col-start-2 row-start-1 sm:col-start-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {draft.conditions.length < CONDITIONS.length && (
        <button type="button" onClick={() => onChange({ ...draft, conditions: [...draft.conditions, { type: CONDITIONS.find((o) => !usedConds.has(o.id))!.id, priorities: [], value: "" }] })} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 mb-4">
          <Plus className="w-4 h-4" /> Add a condition
        </button>
      )}

      <p className={`${label} mt-2`}>Then</p>
      <div className="space-y-2 mt-1 mb-2">
        {draft.actions.map((a, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[180px_minmax(0,1fr)_36px] gap-2 items-start">
            <SingleSelectDropdown
              ariaLabel={`Action ${i + 1}`}
              searchPlaceholder="Search actions..."
              options={ACTIONS}
              selectedId={a.type}
              onChange={(t) => onChange({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { type: t as RuleActionType, value: "" } : x)) })}
            />
            <div className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto">
              {valueField(a.type, a.value, (v) => onChange({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { ...x, value: v } : x)) }), i)}
            </div>
            {draft.actions.length > 1 ? (
              <button type="button" aria-label={`Remove action ${i + 1}`} onClick={() => onChange({ ...draft, actions: draft.actions.filter((_, j) => j !== i) })} className="w-9 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 col-start-2 row-start-1 sm:col-start-auto">
                <X className="w-4 h-4" />
              </button>
            ) : <span className="hidden sm:block" />}
          </div>
        ))}
      </div>
      {draft.actions.length < 5 && (
        <button type="button" onClick={() => onChange({ ...draft, actions: [...draft.actions, { type: "NOTIFY", value: "" }] })} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 mb-4">
          <Plus className="w-4 h-4" /> Add another action
        </button>
      )}

      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 mb-4" data-rule-preview>
        {complete ? <>Reads as: {preview}</> : "Fill in the choices above to see the rule in words."}
      </div>
      {(problem || error) && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">{problem || error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary px-5 py-2.5 text-sm font-bold">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save rule"}
        </button>
      </div>
    </div>
  );
}
