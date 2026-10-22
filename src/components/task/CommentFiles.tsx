import { useState } from "react";
import { File as FileIcon, FileText } from "lucide-react";
import type { Attachment } from "@/lib/api-types";
import { fileUrl } from "@/lib/api";
import { formatFileSize } from "@/lib/files";
import { FilePreview, isImage, isPdf } from "@/components/FilePreview";

// The files posted with one comment: pictures as thumbnails, everything else as a named chip; a click opens the
// same preview as the Files tab, stepping through only this comment's files
export function CommentFiles({ files }: { files: Attachment[] }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  if (!files.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-comment-files>
      {files.map((file, i) =>
        isImage(file) && !broken.has(file.id) ? (
          <button
            key={file.id}
            type="button"
            onClick={() => setPreviewIndex(i)}
            aria-label={`Preview ${file.name}`}
            title={file.name}
            className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <img
              src={fileUrl(file.url)}
              alt=""
              loading="lazy"
              data-thumb={file.id}
              onError={() => setBroken((s) => new Set(s).add(file.id))}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <button
            key={file.id}
            type="button"
            onClick={() => setPreviewIndex(i)}
            aria-label={`Preview ${file.name}`}
            title={file.name}
            className="flex items-center gap-2 max-w-[16rem] h-11 pl-2 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {isPdf(file) ? (
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-[9px] font-black">PDF</span>
            ) : file.fileType.includes("word") || file.fileType.includes("officedocument") ? (
              <FileText className="w-5 h-5 shrink-0 text-indigo-500" />
            ) : (
              <FileIcon className="w-5 h-5 shrink-0 text-slate-500" />
            )}
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">{formatFileSize(file.fileSize)}</span>
            </span>
          </button>
        )
      )}
      {previewIndex !== null && files[previewIndex] && (
        <FilePreview files={files} index={previewIndex} onIndex={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  );
}
