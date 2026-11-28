import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Check, CheckCircle2, Clock, ImagePlus, Loader2, PackageX, QrCode, RotateCcw, Trash2, Wrench, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset, AssetEvent, Project, User } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { useNavigation } from "@/context/NavigationContext";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AssignAssetModal } from "@/components/assets/AssignAssetModal";
import { ReturnAssetModal } from "@/components/assets/ReturnAssetModal";
import { RepairAssetModal } from "@/components/assets/RepairAssetModal";
import { ReportProblemModal } from "@/components/assets/ReportProblemModal";
import { QRCodeModal } from "@/components/assets/QRCodeModal";
import { assignablePeople, CONDITION_LABEL, describeItem, holderName, StatusPill, warrantyText, type AssetRow } from "@/components/assets/assetUi";

type FullAsset = AssetRow & { canManage?: boolean; isHolder?: boolean };
type Dialog = "assign" | "return" | "repair" | "repairDone" | "report" | "qr" | "lost" | "retire" | "delete" | null;

// History wording by kind of entry (so entries saved with older wording read the same way)
const EVENT_LABEL: Record<string, string> = {
  CREATED: "Added", UPDATED: "Changed", ASSIGNED: "Assigned", RECEIPT_CONFIRMED: "Received", RETURNED: "Returned",
  MARKED_FOR_REPAIR: "Sent to repair", REPAIR_COMPLETED: "Repair done", MARKED_LOST: "Marked lost", RETIRED: "Retired",
  DELETED: "Deleted", RESTORED: "Restored", PROBLEM_REPORTED: "Problem reported", COLLECTION_REQUESTED: "To collect"
};
// "Changed" entries saved with the copied module's wording read plainly too
const OLD_CHANGE_WORDING: Record<string, { label: string; strip: RegExp }> = {
  "Photo Uploaded": { label: "Photo added", strip: /^Uploaded asset photograph:\s*/ },
  "Photo Deleted": { label: "Photo removed", strip: /^Deleted asset photograph:\s*/ },
  "Asset Details Updated": { label: "Details changed", strip: /^Asset details were modified$/ }
};
const eventLabel = (h: AssetEvent) =>
  h.eventType === "UPDATED" ? OLD_CHANGE_WORDING[h.title]?.label ?? h.title : EVENT_LABEL[h.eventType] ?? h.title;
// Older entries saved codes and ids ("Receipt confirmed by cm…", "Disposition: STOCK"): say them in words
const OLD_DETAIL: Partial<Record<string, (d: string) => string>> = {
  RECEIPT_CONFIRMED: (d) => (/^Receipt confirmed by \S+$/.test(d) ? "Confirmed they have it" : d),
  RETURNED: (d) => d.replace(/^Returned from (.+) \(Disposition: (\w+)\)$/, (_m, who, to) => `Returned by ${who}, ${to === "REPAIR" ? "sent to repair" : "back in stock"}`),
  REPAIR_COMPLETED: (d) => d.replace(/^Repair completed\. Condition: (\w+)\. Disposition: (\w+)$/, (_m, c, to) => `Condition ${c.toLowerCase()}, ${to === "ASSIGN" ? "assigned again" : "back in stock"}`),
  MARKED_LOST: (d) => (d === "Asset reported lost" ? "Reported lost" : d),
  RETIRED: (d) => (d === "Asset formally retired" ? "No longer in use" : d),
  DELETED: (d) => (/^Asset moved to trash/.test(d) ? "Kept in Recently deleted for 30 days" : d),
  RESTORED: (d) => (d === "Asset restored from Recently Deleted" ? "Brought back from Recently deleted" : d)
};
const eventDetail = (h: AssetEvent) => {
  if (h.eventType === "CREATED") return "";
  const old = h.eventType === "UPDATED" ? OLD_CHANGE_WORDING[h.title] : undefined;
  if (old) return h.description.replace(old.strip, "");
  return OLD_DETAIL[h.eventType]?.(h.description ?? "") ?? h.description;
};

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// One asset: details, who has it, photos, history, and only the buttons this person may use
export function AssetDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { setEntityName } = useNavigation();
  const isAdmin = currentUser?.role === "Admin";
  const [asset, setAsset] = useState<FullAsset | null>(null);
  const [history, setHistory] = useState<AssetEvent[]>([]);
  const [missing, setMissing] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () =>
    Promise.all([api.getAsset(id), api.getAssetHistory(id).catch(() => [] as AssetEvent[])])
      .then(([a, h]) => {
        setAsset(a as FullAsset);
        setEntityName(id, a.assetTag); // the page trail shows "Assets > ENT-LAP-0042", not the raw id
        setHistory(h);
        setMissing(false);
      })
      .catch(() => setMissing(true));
  useEffect(() => {
    setAsset(null);
    void load();
  }, [id]);
  useEffect(() => {
    if (!asset?.canManage || people.length) return;
    api.getTeam().then(setPeople).catch(() => undefined);
    api.getProjects().then((p) => setProjects(p as Project[])).catch(() => undefined);
  }, [asset?.canManage]);

  const assignable = useMemo(() => assignablePeople(people, currentUser), [people, currentUser]);
  const done = (msg?: string) => {
    if (msg) toast.success(msg);
    setDialog(null);
    void load();
  };

  if (missing) {
    return (
      <div className="card p-10 text-center max-w-xl mx-auto" data-asset-missing>
        <p className="font-semibold text-slate-800 dark:text-slate-100">This asset isn't available</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">It may have been deleted, or it belongs to another team.</p>
        <Link to="/assets" className="btn-secondary inline-flex px-4 py-2 text-sm mt-5">Back to assets</Link>
      </div>
    );
  }
  if (!asset) return <PageLoader />;

  const a = asset;
  const w = warrantyText(a.warrantyEndDate);
  const who = holderName(a);
  const asg = a.activeAssignment;
  const can = !!a.canManage;
  const meta = [
    a.category?.name,
    a.serialNumber ? `Serial ${a.serialNumber}` : null,
    a.purchaseDate ? `Bought ${format(new Date(a.purchaseDate), "d MMM yyyy")}` : null,
    a.vendorName ? `from ${a.vendorName}` : null
  ].filter(Boolean);

  const confirmReceipt = async () => {
    setConfirming(true);
    try {
      await api.confirmAssetReceipt(a.id);
      done("Confirmed as received");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't confirm it. Try again.");
    } finally {
      setConfirming(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await api.uploadAssetPhoto(a.id, f);
      done(files.length === 1 ? "Photo added" : `${files.length} photos added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the photo. Try a PNG, JPEG or WebP under 10 MB.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // Buttons: only what this person may do in the item's current state
  const actions: { key: Dialog; label: string; icon: typeof Check; show: boolean; danger?: boolean }[] = [
    { key: "assign", label: "Assign", icon: ArrowRightLeft, show: can && (a.status === "IN_STOCK" || (a.status === "IN_REPAIR" && !a.currentHolderId)) },
    { key: "return", label: "Return", icon: RotateCcw, show: can && a.status === "ASSIGNED" },
    { key: "repair", label: "Send to repair", icon: Wrench, show: can && (a.status === "ASSIGNED" || a.status === "IN_STOCK") },
    { key: "repairDone", label: "Repair done", icon: CheckCircle2, show: can && a.status === "IN_REPAIR" },
    { key: "qr", label: "QR label", icon: QrCode, show: can },
    { key: "lost", label: "Mark lost", icon: PackageX, show: can && a.status !== "LOST" && a.status !== "RETIRED", danger: true },
    { key: "retire", label: "Retire", icon: X, show: isAdmin && a.status !== "RETIRED" && a.status !== "ASSIGNED", danger: true },
    { key: "delete", label: "Delete", icon: Trash2, show: isAdmin, danger: true }
  ];
  const shown = actions.filter((x) => x.show);

  return (
    <div className="space-y-5 max-w-5xl">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
      </button>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]" data-asset-title>{a.assetTag} · {a.name}</h1>
              <StatusPill asset={a} />
            </div>
            {meta.length > 0 && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 [overflow-wrap:anywhere]">{meta.join(" · ")}</p>}
            <p className={cn("text-sm mt-1", w?.warn ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
              {w ? `Warranty: ${w.text}` : "No warranty date"}
            </p>
          </div>
          {shown.length > 0 && (
            <div className="flex flex-wrap gap-2 lg:justify-end lg:max-w-md" data-asset-actions>
              {shown.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  data-action={x.key}
                  onClick={() => setDialog(x.key)}
                  className={cn("btn-secondary px-3 py-1.5 text-sm inline-flex items-center gap-1.5", x.danger && "text-red-600 dark:text-red-400")}
                >
                  <x.icon className="w-4 h-4" aria-hidden="true" /> {x.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4" data-holder>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Assignee</p>
            {who ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={who} src={a.currentHolder?.avatarUrl ?? undefined} className="w-9 h-9 text-xs" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{who}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.currentHolder?.title || a.currentHolder?.email || ""}</p>
                  </div>
                </div>
                {asg && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
                    {asg.receiptStatus === "CONFIRMED" ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> Received {asg.receiptConfirmedAt ? format(new Date(asg.receiptConfirmedAt), "d MMM yyyy") : ""}</>
                    ) : (
                      <><Clock className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Assigned {asg.assignedAt ? formatDistanceToNow(new Date(asg.assignedAt), { addSuffix: true }) : ""}, not confirmed yet</>
                    )}
                    {` · condition ${CONDITION_LABEL[a.condition] ?? a.condition}`}
                  </p>
                )}
                {a.isHolder && (
                  <div className="flex flex-wrap gap-2 mt-3">
                {asg?.receiptStatus === "PENDING" && (
                  <button type="button" data-confirm-receipt onClick={() => void confirmReceipt()} disabled={confirming} className="btn-primary px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />} I received it
                  </button>
                )}
                <button type="button" data-report-problem onClick={() => setDialog("report")} className="btn-secondary px-3 py-1.5 text-sm">Report a problem</button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">{a.status === "IN_STOCK" ? "Nobody. It's in stock." : "Nobody"}{a.location ? ` · ${a.location}` : ""}</p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Details</p>
            <dl className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              {describeItem(a) && <><dt className="text-slate-500 dark:text-slate-400">Model</dt><dd className="text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere]">{describeItem(a)}</dd></>}
              {a.specifications && <><dt className="text-slate-500 dark:text-slate-400">Specs</dt><dd className="text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere]">{a.specifications}</dd></>}
              {a.location && <><dt className="text-slate-500 dark:text-slate-400">Location</dt><dd className="text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere]">{a.location}</dd></>}
              {a.project && <><dt className="text-slate-500 dark:text-slate-400">For project</dt><dd><Link className="text-indigo-600 dark:text-indigo-400 hover:underline" to={`/projects/${a.project.id}`}>{a.project.name}</Link></dd></>}
              <dt className="text-slate-500 dark:text-slate-400">Condition</dt><dd className="text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere]">{CONDITION_LABEL[a.condition] ?? a.condition}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Photos</h2>
          {can && (
            <>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => void upload(e.target.files)} aria-label="Add photos" />
              <button type="button" data-add-photo onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-secondary px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />} Add photo
              </button>
            </>
          )}
        </div>
        {a.files?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {a.files.map((f) => (
              <div key={f.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-50 dark:bg-slate-800">
                <a href={f.downloadUrl} target="_blank" rel="noreferrer"><img src={f.downloadUrl} alt={f.name} className="w-full h-full object-cover" /></a>
                {can && (
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={async () => {
                      try {
                        await api.deleteAssetPhoto(a.id, f.id);
                        done("Photo removed");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Couldn't remove the photo");
                      }
                    }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-white/90 dark:bg-slate-900/90 text-slate-600 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No photos yet.</p>
        )}
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Nothing yet.</p>
        ) : (
          <ol className="mt-3 space-y-3" data-history>
            {history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-24 shrink-0 pt-0.5" title={format(new Date(h.createdAt), "d MMM yyyy, h:mm a")}>{format(new Date(h.createdAt), "d MMM yyyy")}</span>
                <span className="min-w-0 text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{eventLabel(h)}</span>
                  {eventDetail(h) ? <span className="text-slate-500 dark:text-slate-400">: {eventDetail(h)}</span> : null}
                  {h.performedBy?.fullName ? <span className="text-slate-400 dark:text-slate-500"> · {h.performedBy.fullName}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {dialog === "assign" && <AssignAssetModal isOpen asset={a} users={assignable} projects={projects} onClose={() => setDialog(null)} onAssigned={() => done()} />}
      {dialog === "return" && <ReturnAssetModal isOpen asset={a} onClose={() => setDialog(null)} onReturned={() => done()} />}
      {(dialog === "repair" || dialog === "repairDone") && (
        <RepairAssetModal isOpen asset={a} mode={dialog === "repair" ? "MARK_REPAIR" : "COMPLETE_REPAIR"} users={assignable} projects={projects} onClose={() => setDialog(null)} onUpdated={() => done()} />
      )}
      {dialog === "report" && <ReportProblemModal isOpen asset={a} onClose={() => setDialog(null)} onReported={() => done()} />}
      {dialog === "qr" && <QRCodeModal isOpen asset={a} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "lost" || dialog === "retire" || dialog === "delete"}
        title={dialog === "lost" ? `Mark ${a.assetTag} as lost?` : dialog === "retire" ? `Retire ${a.assetTag}?` : `Delete ${a.assetTag}?`}
        message={
          dialog === "lost"
            ? "It stays in the register as lost, and whoever had it no longer holds it."
            : dialog === "retire"
              ? "Use this when it's sold, scrapped or too old to use. It can't be handed out again."
              : "It goes to Recently deleted for 30 days. Its history is kept."
        }
        confirmLabel={dialog === "lost" ? "Mark lost" : dialog === "retire" ? "Retire" : "Delete"}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          try {
            if (dialog === "lost") {
              await api.markAssetLost(a.id);
              done("Marked as lost");
            } else if (dialog === "retire") {
              await api.retireAsset(a.id);
              done("Retired");
            } else {
              await api.deleteAsset(a.id);
              toast.success("Moved to Recently deleted");
              navigate("/assets");
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
            setDialog(null);
          }
        }}
      />
    </div>
  );
}
