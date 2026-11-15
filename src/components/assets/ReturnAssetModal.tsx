import React, { useState } from "react";
import { useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset, AssetCondition } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

interface ReturnAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated?: Asset) => void;
  onReturned?: (updated: Asset) => void;
  asset: Asset | null;
}

export function ReturnAssetModal({
  isOpen,
  onClose,
  onSuccess,
  onReturned,
  asset
}: ReturnAssetModalProps) {
  useEscapeToClose(isOpen, onClose);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnCondition, setReturnCondition] = useState<AssetCondition>("GOOD");
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnDisposition, setReturnDisposition] = useState<"STOCK" | "REPAIR">("STOCK");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && asset) {
      setReturnDate(new Date().toISOString().split("T")[0]);
      setReturnCondition(asset.condition || "GOOD");
      setReturnRemarks("");
      setReturnDisposition("STOCK");
    }
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updated = await api.returnAsset(asset.id, {
        returnDate,
        returnCondition,
        returnRemarks: returnRemarks.trim() || undefined,
        returnDisposition
      });
      toast.success(`Asset ${asset.assetTag} successfully processed`);
      onSuccess?.(updated);
      onReturned?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to return asset");
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
              <CornerDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Return</h3>
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
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">With:</span>{" "}
            {asset.currentHolder?.name || (asset.currentHolder as any)?.fullName || "Assigned person"}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Return Date
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full h-10 px-3.5 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Return Condition
              </label>
              <SingleSelectDropdown
                options={[
                  { id: "NEW", name: "New" },
                  { id: "GOOD", name: "Good" },
                  { id: "FAIR", name: "Fair" },
                  { id: "DAMAGED", name: "Damaged" }
                ]}
                selectedId={returnCondition}
                onChange={(id) => setReturnCondition(id as AssetCondition)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Return Disposition <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                  returnDisposition === "STOCK"
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="returnDisposition"
                    value="STOCK"
                    checked={returnDisposition === "STOCK"}
                    onChange={() => setReturnDisposition("STOCK")}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-xs font-bold">Return to Stock</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ready for reassignment
                </span>
              </label>

              <label
                className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                  returnDisposition === "REPAIR"
                    ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="returnDisposition"
                    value="REPAIR"
                    checked={returnDisposition === "REPAIR"}
                    onChange={() => setReturnDisposition("REPAIR")}
                    className="w-4 h-4 text-amber-600"
                  />
                  <span className="text-xs font-bold">Send for Repair</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Requires maintenance
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Return Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Device returned in clean working order with charger"
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              className="w-full p-3 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg custom-scrollbar resize-none"
            />
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
              {isSubmitting ? "Processing..." : "Return"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

