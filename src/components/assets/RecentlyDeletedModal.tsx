import React, { useEffect, useState } from "react";
import { useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";

interface RecentlyDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onRestored?: (restored: Asset) => void;
}

export function RecentlyDeletedModal({
  isOpen,
  onClose,
  onSuccess,
  onRestored
}: RecentlyDeletedModalProps) {
  useEscapeToClose(isOpen, onClose);
  const [deletedAssets, setDeletedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRecentlyDeletedAssets();
      setDeletedAssets(data);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to load recently deleted assets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (asset: Asset) => {
    setRestoringId(asset.id);
    try {
      const restored = await api.restoreAsset(asset.id);
      toast.success(`Asset ${asset.assetTag} restored successfully`);
      setDeletedAssets((prev) => prev.filter((a) => a.id !== asset.id));
      onSuccess?.();
      onRestored?.(restored);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to restore asset");
    } finally {
      setRestoringId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Recently deleted</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assets retained for 30 days before permanent purging. Serial numbers remain reserved.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading deleted assets...</div>
          ) : deletedAssets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Trash is Empty</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                There are no recently deleted assets in the retention window.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              {deletedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
                        {asset.assetTag}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {asset.category?.name || "Asset"}
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {asset.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Deleted on {asset.deletedAt ? safeFormat(asset.deletedAt, "dd MMM yyyy") : "Recently"}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={restoringId === asset.id}
                    onClick={() => handleRestore(asset)}
                    className="btn-secondary h-9 px-3.5 text-xs font-semibold flex items-center gap-1.5 shrink-0 hover:border-indigo-500 hover:text-indigo-600"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoringId === asset.id ? "animate-spin" : ""}`} />
                    <span>{restoringId === asset.id ? "Restoring..." : "Restore"}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary h-10 px-5 text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

