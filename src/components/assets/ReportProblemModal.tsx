import React, { useState } from "react";
import { useEscapeToClose } from "./assetUi";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Asset } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onReported?: () => void;
  asset: Asset | null;
}

export function ReportProblemModal({
  isOpen,
  onClose,
  onSuccess,
  onReported,
  asset
}: ReportProblemModalProps) {
  useEscapeToClose(isOpen, onClose);
  const [problemCategory, setProblemCategory] = useState<
    "HARDWARE" | "SOFTWARE" | "PHYSICAL_DAMAGE" | "LOST_STOLEN" | "OTHER"
  >("HARDWARE");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setProblemCategory("HARDWARE");
      setDescription("");
      setPhotoFile(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
  }, [isOpen]);

  if (!isOpen || !asset) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please upload an image (PNG, JPEG, WebP)");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please provide a description of the problem");
      return;
    }

    setIsSubmitting(true);
    try {
      let photoUrl: string | undefined = undefined;
      if (photoFile) {
        try {
          const uploaded = await api.uploadAssetPhoto(asset.id, photoFile);
          photoUrl = uploaded.url;
        } catch (uploadErr) {
          // Don't send the report as if the photo were attached: say so and let them try again
          toast.error(uploadErr instanceof Error ? uploadErr.message : "Couldn't attach the photo. Try a PNG, JPEG or WebP under 10 MB.");
          return;
        }
      }

      await api.reportAssetProblem(asset.id, {
        problemCategory,
        description: description.trim(),
        photoUrl
      });

      toast.success("Problem reported. Your manager and Admin have been notified.");
      onSuccess?.();
      onReported?.();
      onClose();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to report problem");
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
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Report a problem</h3>
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
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Problem Category <span className="text-rose-500">*</span>
            </label>
            <SingleSelectDropdown
              options={[
                { id: "HARDWARE", name: "Hardware Malfunction (Power, Battery, Screen, Keyboard)" },
                { id: "SOFTWARE", name: "Software / OS / License Issue" },
                { id: "PHYSICAL_DAMAGE", name: "Physical Damage / Drop / Spill" },
                { id: "LOST_STOLEN", name: "Lost or Stolen Device" },
                { id: "OTHER", name: "Something else" }
              ]}
              selectedId={problemCategory}
              onChange={(id) => setProblemCategory(id as any)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe what happened, when the issue started, and any symptoms observed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 input text-sm focus:outline-none transition-all dark:text-slate-100 rounded-lg custom-scrollbar resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Photograph / Evidence <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            {photoPreview ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                <img src={photoPreview} alt="Photo of the problem" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <label className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Attach photo of issue</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </label>
            )}
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
              className="btn-primary h-10 px-6 text-sm font-semibold flex items-center gap-2 bg-rose-600 hover:bg-rose-700 border-none"
            >
              {isSubmitting ? "Submitting..." : "Send report"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

