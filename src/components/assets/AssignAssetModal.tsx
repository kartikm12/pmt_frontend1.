import React, { useState, useMemo } from "react";
import { useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, UserCheck, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Asset, AssetCondition, Project, User } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onAssigned?: (updated: Asset) => void;
  asset: Asset | null;
  users: User[];
  projects: Project[];
}

export function AssignAssetModal({
  isOpen,
  onClose,
  onSuccess,
  onAssigned,
  asset,
  users,
  projects
}: AssignAssetModalProps) {
  useEscapeToClose(isOpen, onClose);
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";

  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute reporting hierarchy: employees who report directly or indirectly to current user
  const hierarchyIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const result = new Set<string>();
    const queue = [currentUser.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const u of users) {
        if (u.reportsToId === cur && !result.has(u.id)) {
          result.add(u.id);
          queue.push(u.id);
        }
      }
    }
    return result;
  }, [currentUser, users]);

  // Filter eligible assignees: Admin can assign to anyone; Manager can assign to hierarchy + self
  const eligibleUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.status === "Suspended") return false;
      if (isAdmin) return true;
      return hierarchyIds.has(u.id) || u.id === currentUser?.id;
    });
  }, [users, isAdmin, hierarchyIds, currentUser]);

  const userOptions = useMemo(() => {
    return eligibleUsers.map((u) => {
      let suffix = "";
      if (u.id === currentUser?.id) {
        suffix = " (You)";
      } else if (!isAdmin && hierarchyIds.has(u.id)) {
        suffix = " — Reports to you";
      }
      return {
        id: u.id,
        name: `${u.name} (${u.role})${suffix}`
      };
    });
  }, [eligibleUsers, currentUser, isAdmin, hierarchyIds]);

  React.useEffect(() => {
    if (isOpen && asset) {
      setEmployeeId("");
      setProjectId(asset.projectId || "");
      setCondition(asset.condition || "GOOD");
      setNotes("");
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Please select an employee");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await api.assignAsset(asset.id, {
        employeeId,
        projectId: projectId || undefined,
        assignmentCondition: condition,
        notes: notes.trim() || undefined
      });
      toast.success(`Asset ${asset.assetTag} assigned successfully`);
      onSuccess?.();
      onAssigned?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to assign asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Hand over</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{asset.name} ({asset.assetTag})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isAdmin && hierarchyIds.size === 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                Reporting Hierarchy
              </p>
              <p className="mt-1 leading-relaxed">
                As a Manager, you can only assign assets to employees who report to you in your team hierarchy. Currently, no employees have you set as their Reporting Manager on the <strong>Team</strong> page. An Admin can configure this in Team settings.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Who gets it <span className="text-rose-500">*</span></span>
              {!isAdmin && hierarchyIds.size > 0 && (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-normal">
                  {hierarchyIds.size} team member{hierarchyIds.size > 1 ? "s" : ""} report to you
                </span>
              )}
            </label>
            <SingleSelectDropdown
              options={userOptions}
              selectedId={employeeId}
              onChange={setEmployeeId}
              placeholder={userOptions.length === 0 ? "No eligible employees found..." : "Pick a person..."}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Project <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <SingleSelectDropdown
              options={[
                { id: "", name: "No project" },
                ...projects.map((p) => ({ id: p.id, name: p.name }))
              ]}
              selectedId={projectId}
              onChange={setProjectId}
              placeholder="Select Project..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Handover Condition
            </label>
            <SingleSelectDropdown
              options={[
                { id: "NEW", name: "New" },
                { id: "GOOD", name: "Good" },
                { id: "FAIR", name: "Fair" },
                { id: "DAMAGED", name: "Damaged" }
              ]}
              selectedId={condition}
              onChange={(id) => setCondition(id as AssetCondition)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Assignment Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Assigned for Q4 mobile testing project"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg custom-scrollbar resize-none"
            />
          </div>

          <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-300">
            The employee will be notified in-app and by email to confirm receipt of this asset.
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="btn-secondary h-10 px-5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary h-10 px-6 text-sm font-semibold flex items-center gap-2"
            >
              {isSubmitting ? "Assigning..." : "Hand over"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

