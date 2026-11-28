import React, { useState } from "react";
import { useAssigneeProjects, useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, Wrench, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset, AssetCondition, Project, User } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

interface RepairAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated?: Asset) => void;
  onUpdated?: (updated: Asset) => void;
  asset: Asset | null;
  mode?: "MARK_REPAIR" | "COMPLETE_REPAIR";
  users?: User[];
  projects?: Project[];
}

export function RepairAssetModal({
  isOpen,
  onClose,
  onSuccess,
  onUpdated,
  asset,
  mode: propMode,
  users = [],
  projects = []
}: RepairAssetModalProps) {
  useEscapeToClose(isOpen, onClose);
  const mode = propMode || (asset?.status === "IN_REPAIR" ? "COMPLETE_REPAIR" : "MARK_REPAIR");
  // Mark Repair fields
  const [problemDescription, setProblemDescription] = useState("");
  const [remarks, setRemarks] = useState("");

  // Complete Repair fields
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [disposition, setDisposition] = useState<"STOCK" | "ASSIGN">("STOCK");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const assigneeProjects = useAssigneeProjects(projects, employeeId, projectId, setProjectId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && asset) {
      setProblemDescription("");
      setRemarks("");
      setCondition("GOOD");
      setDisposition("STOCK");
      setEmployeeId("");
      setProjectId("");
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let updated: Asset;
      if (mode === "MARK_REPAIR") {
        if (!problemDescription.trim()) {
          toast.error("Please describe the issue");
          return;
        }
        updated = await api.markAssetRepair(asset.id, {
          problemDescription: problemDescription.trim(),
          remarks: remarks.trim() || undefined
        });
        toast.success(`Asset ${asset.assetTag} marked as In Repair`);
      } else {
        if (disposition === "ASSIGN" && !employeeId) {
          toast.error("Please select an employee for reassignment");
          return;
        }
        updated = await api.completeAssetRepair(asset.id, {
          condition,
          disposition,
          employeeId: disposition === "ASSIGN" ? employeeId : undefined,
          projectId: disposition === "ASSIGN" && projectId ? projectId : undefined,
          remarks: remarks.trim() || undefined
        });
        toast.success(`Repair completed for asset ${asset.assetTag}`);
      }
      onSuccess?.(updated);
      onUpdated?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to update repair status");
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
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              {mode === "MARK_REPAIR" ? <Wrench className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {mode === "MARK_REPAIR" ? "Send to repair" : "Repair done"}
              </h3>
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
          {mode === "MARK_REPAIR" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Problem Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Screen flickering, keyboard key broken, fan making grinding noise"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="w-full p-3 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg custom-scrollbar resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Remarks / Repair Center (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sent to authorized Dell Service Center"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Restored Condition <span className="text-rose-500">*</span>
                </label>
                <SingleSelectDropdown
                  options={[
                    { id: "GOOD", name: "Good - Fully Repaired" },
                    { id: "FAIR", name: "Fair - Functional with Minor Blemishes" },
                    { id: "NEW", name: "New - Replaced Unit" }
                  ]}
                  selectedId={condition}
                  onChange={(id) => setCondition(id as AssetCondition)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Post-Repair Disposition <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                      disposition === "STOCK"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="disposition"
                        value="STOCK"
                        checked={disposition === "STOCK"}
                        onChange={() => setDisposition("STOCK")}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-xs font-bold">Return to Stock</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Available in inventory</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                      disposition === "ASSIGN"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="disposition"
                        value="ASSIGN"
                        checked={disposition === "ASSIGN"}
                        onChange={() => setDisposition("ASSIGN")}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-xs font-bold">Assign</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Assign immediately</span>
                  </label>
                </div>
              </div>

              {disposition === "ASSIGN" && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Assignee <span className="text-rose-500">*</span>
                    </label>
                    <SingleSelectDropdown
                      options={users.map((u) => ({ id: u.id, name: `${u.name} (${u.role})` }))}
                      selectedId={employeeId}
                      onChange={setEmployeeId}
                      placeholder="Pick the assignee..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Project <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <SingleSelectDropdown
                      options={[
                        { id: "", name: "No project" },
                        ...assigneeProjects.map((p) => ({ id: p.id, name: p.name }))
                      ]}
                      selectedId={projectId}
                      onChange={setProjectId}
                      placeholder={employeeId ? (assigneeProjects.length ? "Pick one of their projects..." : "They aren't on any project") : "Pick the assignee first"}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Repair Completion Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Display panel replaced under warranty"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
                />
              </div>
            </>
          )}

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
              {isSubmitting ? "Submitting..." : mode === "MARK_REPAIR" ? "Send to repair" : "Repair done"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

