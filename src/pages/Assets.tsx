import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Laptop, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset, AssetCategory, AssetSummary, Project, User } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { isManager } from "@/utils/roleUtils";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { Avatar } from "@/components/ui/Avatar";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { AddAssetModal } from "@/components/assets/AddAssetModal";
import { RecentlyDeletedModal } from "@/components/assets/RecentlyDeletedModal";
import { ReportProblemModal } from "@/components/assets/ReportProblemModal";
import { assignablePeople, describeItem, holderName, StatusPill, warrantyText, type AssetRow } from "@/components/assets/assetUi";

// Assets: Admins and managers get the register (managers only see their team, the shared stock and what's
// theirs); everyone else gets "Your assets" (what they hold, no costs or serial numbers).
export function Assets() {
  const { currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  if (!isManager(currentUser?.role)) return <MyAssets />;
  const view = params.get("view") === "mine" ? "mine" : "register";
  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900" role="tablist">
        {(["register", "mine"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setParams(v === "mine" ? { view: "mine" } : {}, { replace: true })}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", view === v ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800")}
          >
            {v === "register" ? "Register" : "Your assets"}
          </button>
        ))}
      </div>
      {view === "mine" ? <MyAssets embedded /> : <Register />}
    </div>
  );
}

const STATUS_OPTIONS = [
  { id: "", name: "Any status" },
  { id: "ASSIGNED", name: "Assigned" },
  { id: "IN_STOCK", name: "In stock" },
  { id: "IN_REPAIR", name: "In repair" },
  { id: "LOST", name: "Lost" },
  { id: "RETIRED", name: "Retired" }
];
const WARRANTY_OPTIONS = [
  { id: "", name: "Any warranty" },
  { id: "30_days", name: "Ends within 30 days" },
  { id: "60_days", name: "Ends within 60 days" },
  { id: "expired", name: "Ended" }
];
const PAGE = 20;

function Register() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";
  const [items, setItems] = useState<AssetRow[] | null>(null);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [warranty, setWarranty] = useState("");
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [adding, setAdding] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    api.getAssetCategories().then(setCategories).catch(() => undefined);
    api.getTeam().then(setPeople).catch(() => undefined);
    api.getProjects().then((p) => setProjects(p as Project[])).catch(() => undefined);
  }, []);

  const load = (nextPage = 1) => {
    const seq = ++loadSeq.current;
    if (nextPage > 1) setLoadingMore(true);
    return api
      .getAssets({ search, categoryId, status, warrantyExpiry: warranty, page: nextPage, limit: PAGE })
      .then((res) => {
        if (seq !== loadSeq.current) return; // an older search answered late
        setSummary(res.summary);
        setTotal(res.pagination.total);
        setPage(nextPage);
        setItems((prev) => (nextPage > 1 && prev ? [...prev, ...(res.items as AssetRow[])] : (res.items as AssetRow[])));
        setError("");
      })
      .catch((e) => seq === loadSeq.current && setError(e instanceof Error ? e.message : "Couldn't load assets"))
      .finally(() => setLoadingMore(false));
  };
  useEffect(() => {
    void load(1);
  }, [search, categoryId, status, warranty]);

  const assignable = useMemo(() => assignablePeople(people, currentUser), [people, currentUser]);
  const filtersOn = !!(search || categoryId || status || warranty);
  const clearFilters = () => {
    setQuery("");
    setSearch("");
    setCategoryId("");
    setStatus("");
    setWarranty("");
  };

  if (!items && !error) return <PageLoader />;

  const cards = [
    { label: "Assigned", value: summary?.assigned ?? 0, filter: "ASSIGNED" },
    { label: "In stock", value: summary?.inStock ?? 0, filter: "IN_STOCK" },
    { label: "In repair", value: summary?.inRepair ?? 0, filter: "IN_REPAIR" },
    { label: "Lost", value: summary?.lost ?? 0, filter: "LOST", warn: (summary?.lost ?? 0) > 0 }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin ? "Everything the company owns and who has it." : "Your team's things, the shared stock, and items you added."}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button type="button" onClick={() => setShowDeleted(true)} className="btn-secondary px-3 py-2 text-sm inline-flex items-center gap-2">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Recently deleted
            </button>
          )}
          <button type="button" data-add-asset onClick={() => setAdding(true)} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> Add asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            data-summary={c.filter}
            onClick={() => setStatus(status === c.filter ? "" : c.filter)}
            className={cn("card p-4 text-left transition-colors", status === c.filter ? "ring-2 ring-indigo-500" : "hover:border-slate-300 dark:hover:border-slate-600")}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={cn("text-2xl font-semibold mt-1", c.warn ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white")}>{c.value}</p>
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag, name, brand, serial"
              aria-label="Search assets"
              className="input w-full pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:w-[540px]">
            <SingleSelectDropdown ariaLabel="Category" options={[{ id: "", name: "Any category" }, ...categories.map((c) => ({ id: c.id, name: c.name }))]} selectedId={categoryId} onChange={setCategoryId} searchPlaceholder="Search categories..." />
            <SingleSelectDropdown ariaLabel="Status" options={STATUS_OPTIONS} selectedId={status} onChange={setStatus} searchPlaceholder="Search statuses..." />
            <SingleSelectDropdown ariaLabel="Warranty" options={WARRANTY_OPTIONS} selectedId={warranty} onChange={setWarranty} searchable={false} />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400 py-8 text-center">{error}</p>
        ) : items!.length === 0 ? (
          <div className="py-12 text-center" data-assets-empty>
            <Laptop className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">{filtersOn ? "Nothing matches these filters" : "No assets yet"}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{filtersOn ? "Try fewer filters." : "Add the first laptop, monitor or phone with Add asset."}</p>
            {filtersOn && (
              <button type="button" onClick={clearFilters} className="btn-secondary px-3 py-1.5 text-sm mt-4 inline-flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-2 pt-5 pb-2 text-xs text-slate-400 dark:text-slate-500">
              <span>Asset</span>
              <span>With</span>
              <span>Status</span>
              <span>Warranty</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 mt-3 md:mt-0">
              {items!.map((a) => {
                const w = warrantyText(a.warrantyEndDate);
                const who = holderName(a);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      data-asset-row={a.assetTag}
                      onClick={() => navigate(`/assets/${a.id}`)}
                      className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-center px-2 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{a.assetTag}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{a.name}{describeItem(a) && describeItem(a) !== a.name ? ` · ${describeItem(a)}` : ""}</span>
                      </span>
                      <span className="md:order-none order-last col-span-2 md:col-span-1 min-w-0 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        {who ? (
                          <>
                            <Avatar name={who} src={a.currentHolder?.avatarUrl ?? undefined} className="w-6 h-6 text-[10px] shrink-0" />
                            <span className="truncate">{who}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">Nobody</span>
                        )}
                      </span>
                      <span className="justify-self-end md:justify-self-start"><StatusPill asset={a} /></span>
                      <span className={cn("hidden md:block text-sm", w?.warn ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300")}>{w?.text ?? <span className="text-slate-400">-</span>}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items!.length < total && (
              <div className="pt-4 text-center">
                <button type="button" onClick={() => void load(page + 1)} disabled={loadingMore} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2">
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Show more ({total - items!.length} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {adding && (
        <AddAssetModal
          isOpen={adding}
          onClose={() => setAdding(false)}
          categories={categories}
          users={assignable}
          projects={projects}
          onCreated={(a) => {
            setAdding(false);
            navigate(`/assets/${a.id}`);
          }}
        />
      )}
      {showDeleted && <RecentlyDeletedModal isOpen={showDeleted} onClose={() => setShowDeleted(false)} onRestored={() => void load(1)} />}
    </div>
  );
}

// What one person holds. Members only ever see this; managers see it under "Your assets".
export function MyAssets({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<AssetRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Asset | null>(null);

  const load = () =>
    api
      .getMyAssets()
      .then((r) => setItems(r as AssetRow[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your assets"));
  useEffect(() => {
    void load();
  }, []);

  const confirm = async (a: Asset) => {
    setBusy(a.id);
    try {
      await api.confirmAssetReceipt(a.id);
      toast.success(`Thanks, ${a.name} is confirmed as received`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't confirm it. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!items && !error) return <PageLoader />;
  return (
    <div className="space-y-5 max-w-3xl">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your assets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Company things you have. Tell your manager here if something is wrong.</p>
        </div>
      )}
      {error ? (
        <p className="card p-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : items!.length === 0 ? (
        <div className="card p-10 text-center" data-my-assets-empty>
          <Laptop className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">You don't have any company assets</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">When your manager hands you a laptop or phone, it shows here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items!.map((a) => {
            const pending = a.activeAssignment?.receiptStatus === "PENDING";
            const w = warrantyText(a.warrantyEndDate);
            const since = a.activeAssignment?.assignedAt;
            return (
              <div key={a.id} data-my-asset={a.assetTag} className={cn("card p-5 flex flex-col", pending && "border-amber-300 dark:border-amber-700")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{a.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {a.assetTag}
                      {since ? ` · since ${format(new Date(since), "d MMM yyyy")}` : ""}
                    </p>
                  </div>
                  <StatusPill asset={a} />
                </div>
                {(describeItem(a) || a.specifications) && <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">{[describeItem(a), a.specifications].filter(Boolean).join(" · ")}</p>}
                {w && <p className={cn("text-xs mt-2", w.warn ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>Warranty: {w.text}</p>}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {pending && (
                    <button type="button" data-confirm-receipt onClick={() => void confirm(a)} disabled={busy === a.id} className="btn-primary px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
                      {busy === a.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />} I received it
                    </button>
                  )}
                  <button type="button" data-report-problem onClick={() => setReporting(a)} className="btn-secondary px-3 py-1.5 text-sm">
                    {pending ? "Something's wrong" : "Report a problem"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {reporting && (
        <ReportProblemModal
          isOpen={!!reporting}
          asset={reporting}
          onClose={() => setReporting(null)}
          onReported={() => {
            setReporting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
