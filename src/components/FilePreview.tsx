import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { fileUrl } from "@/lib/api";
import type { Attachment } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";

export const isImage = (f: Pick<Attachment, "fileType">) => /^image\/(png|jpe?g|gif|webp|svg\+xml|avif)$/i.test(f.fileType);
export const isPdf = (f: Pick<Attachment, "fileType">) => f.fileType === "application/pdf";

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

// Full-screen preview of one file, with left/right through the list. Images and PDFs show inline;
// anything else offers Download. Esc closes, arrow keys move, focus returns to where it was.
export function FilePreview({ files, index, onIndex, onClose }: { files: Attachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const file = files[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = files.length > 1;
  const go = (step: number) => onIndex((index + step + files.length) % files.length);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      back?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!file) return null;
  const href = fileUrl(file.url);

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-slate-950/70 flex items-stretch sm:items-center justify-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`} className="bg-white dark:bg-slate-900 w-full sm:max-w-5xl h-full sm:h-[88vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 dark:text-white truncate" title={file.name}>{file.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {size(file.fileSize)}
              {file.user?.name && ` · uploaded by ${file.user.name}`}
              {` · ${safeFormat(file.createdAt, "MMM d")}`}
              {many && ` · ${index + 1} of ${files.length}`}
            </p>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-2 text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
          </a>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" title="Open in a new tab" className="hidden sm:flex btn-secondary p-2">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button ref={closeRef} onClick={onClose} aria-label="Close preview" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          {isImage(file) ? (
            <img key={file.id} src={href} alt={file.name} className="max-w-full max-h-full object-contain" data-preview="image" />
          ) : isPdf(file) ? (
            <iframe key={file.id} src={href} title={file.name} className="w-full h-full bg-white" data-preview="pdf" />
          ) : (
            <div className="text-center p-8" data-preview="none">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">No preview for this type of file</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Download it to open it on your device.</p>
              <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary px-4 py-2 text-sm font-bold inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          )}
          {many && (
            <>
              <button onClick={() => go(-1)} aria-label="Previous file" className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-slate-800/90 shadow text-slate-700 dark:text-slate-200 hover:bg-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => go(1)} aria-label="Next file" className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-slate-800/90 shadow text-slate-700 dark:text-slate-200 hover:bg-white">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
