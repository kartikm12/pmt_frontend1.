import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { User } from "@/lib/api-types";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Pending = Awaited<ReturnType<typeof api.getPendingSignups>>[number];

// Self sign-ups waiting for a manager: pick their role, then approve or reject
export function PendingSignups({ roleOptions, onApproved }: { roleOptions: User["role"][]; onApproved: () => void }) {
  const [items, setItems] = useState<Pending[]>([]);
  const [roles, setRoles] = useState<Record<string, User["role"]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toReject, setToReject] = useState<Pending | null>(null);

  const load = () => api.getPendingSignups().then(setItems).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);

  if (!items.length) return null;

  const approve = async (p: Pending) => {
    setBusyId(p.id);
    try {
      const role = roles[p.id] ?? "Team Member";
      await api.approveSignup(p.id, role);
      toast.success(`${p.fullName} can now sign in as ${role}`);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      onApproved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't approve");
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    const p = toReject;
    setToReject(null);
    if (!p) return;
    setBusyId(p.id);
    try {
      await api.rejectSignup(p.id);
      toast.success(`${p.fullName}'s sign-up was rejected`);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reject");
      void load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card overflow-hidden border-amber-200 dark:border-amber-900/50" aria-label="Waiting for approval">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-amber-50/60 dark:bg-amber-900/10">
        <UserCheck className="w-5 h-5 text-amber-600" />
        <h2 className="font-bold text-slate-900 dark:text-white">Waiting for approval</h2>
        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-xs font-bold text-amber-800 dark:text-amber-300">{items.length}</span>
        <p className="hidden md:block ml-auto text-xs text-slate-500 dark:text-slate-400">They signed up themselves and can't sign in until you approve them.</p>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((p) => (
          <li key={p.id} data-pending={p.email} className="flex flex-wrap items-center gap-4 px-6 py-4">
            <Avatar name={p.fullName} className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-[180px]">
              <p className="font-bold text-slate-900 dark:text-white">{p.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{p.email} · signed up {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</p>
            </div>
            <select
              value={roles[p.id] ?? "Team Member"}
              onChange={(e) => setRoles({ ...roles, [p.id]: e.target.value as User["role"] })}
              aria-label={`Role for ${p.fullName}`}
              className="input px-3 py-2 text-sm font-semibold dark:text-slate-100"
            >
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={() => void approve(p)} disabled={busyId === p.id} className="btn-primary px-4 py-2 text-sm font-bold disabled:opacity-50" aria-label={`Approve ${p.fullName}`}>
              Approve
            </button>
            <button onClick={() => setToReject(p)} disabled={busyId === p.id} className="px-4 py-2 rounded-xl text-sm font-bold border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50" aria-label={`Reject ${p.fullName}`}>
              Reject
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!toReject}
        title="Reject this sign-up?"
        message={toReject ? `${toReject.fullName}'s account will be removed. They can sign up again later.` : undefined}
        confirmLabel="Reject"
        onConfirm={() => void reject()}
        onCancel={() => setToReject(null)}
      />
    </section>
  );
}
