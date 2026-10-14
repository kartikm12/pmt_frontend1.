import React, { useRef, useState, useEffect } from "react";
import { Paperclip, File as FileIcon, X, Download, Trash2, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { api, fileUrl, mapAttachment } from "@/lib/api";
import type { Attachment } from "@/lib/api-types";
import { toast } from "sonner";
import { safeFormat } from "@/utils/dateUtils";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { isManager } from "@/utils/roleUtils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilePreview, isImage, isPdf } from "@/components/FilePreview";

interface AttachmentSectionProps {
  projectId?: string;
  taskId?: string;
  initialAttachments?: Attachment[];
  // Project role: viewers can't upload; project managers can delete anyone's file
  canContribute?: boolean;
  canManage?: boolean;
  onCountChange?: (count: number) => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes("word") || fileType.includes("officedocument")) return <FileText className="w-5 h-5 text-indigo-500" />;
  return <FileIcon className="w-5 h-5 text-slate-500" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Same types the server accepts (utils/multer.ts), so the picker hides files that would be rejected
const ACCEPTED_FILES = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.ppt,.pptx,.doc,.docx,.xls,.xlsx";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// One shared empty list: a fresh `[]` default each render made the effect below refetch in a loop
const NO_ATTACHMENTS: Attachment[] = [];

export function AttachmentSection({ projectId, taskId, initialAttachments = NO_ATTACHMENTS, canContribute = true, canManage, onCountChange }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  // Count is reported only once the real list is known, so a parent's badge never flashes 0
  const [known, setKnown] = useState(initialAttachments.length > 0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const { currentUser } = useAuth();

  useEffect(() => {
    // If initialAttachments changes or if we want to refresh
    if (initialAttachments.length > 0) {
      setAttachments(initialAttachments);
    } else {
      // Load attachments if none were provided
      api.getAttachments(projectId, taskId).then((list) => { setAttachments(list); setKnown(true); }).catch(console.error);
    }
  }, [projectId, taskId, initialAttachments]);

  useEffect(() => {
    if (known) onCountChange?.(attachments.length);
  }, [known, attachments.length]);

  useEffect(() => {
    if (!socket) return;

    const handleAttachmentAdded = (raw: any) => {
      const data = mapAttachment(raw);
      if (taskId) {
        if (data.taskId === taskId) {
          setAttachments((prev) => (prev.some(a => a.id === data.id) ? prev : [data, ...prev]));
        }
      } else if (projectId) {
        if (data.projectId === projectId) {
          setAttachments((prev) => (prev.some(a => a.id === data.id) ? prev : [data, ...prev]));
        }
      }
    };

    const handleAttachmentDeleted = (data: { id: string; taskId?: string }) => {
      setAttachments((prev) => prev.filter(a => a.id !== data.id));
    };

    socket.on("attachment_added", handleAttachmentAdded);
    socket.on("attachment_deleted", handleAttachmentDeleted);

    return () => {
      socket.off("attachment_added", handleAttachmentAdded);
      socket.off("attachment_deleted", handleAttachmentDeleted);
    };
  }, [socket, taskId, projectId]);

  // One path for the picker, drag-and-drop and paste: same type/size checks, one file after another
  const uploadFiles = async (files: File[]) => {
    if (!files.length || !canContribute) return;
    setIsUploading(true);
    let uploaded = 0;
    for (const file of files) {
      const ext = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
      if (!ACCEPTED_FILES.split(",").includes(ext)) {
        toast.error(`"${file.name}" isn't a file type PMT accepts`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(files.length > 1 ? `"${file.name}" is over the 10 MB limit` : "File size exceeds the 10 MB limit");
        continue;
      }
      try {
        const newAttachment = await api.uploadAttachment(file, projectId, taskId);
        setAttachments((prev) => (prev.some((a) => a.id === newAttachment.id) ? prev : [newAttachment, ...prev]));
        uploaded++;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Couldn't upload "${file.name}"`);
      }
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (uploaded) toast.success(uploaded === 1 ? "File uploaded successfully" : `${uploaded} files uploaded`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => void uploadFiles(Array.from(e.target.files ?? []));

  // Paste (Ctrl+V) anywhere on the page while these files are shown; plain text pastes are left alone.
  // Screenshots arrive as "image.png", so they get a dated name instead.
  useEffect(() => {
    if (!canContribute) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
      void uploadFiles(files.map((f) => (/^image\.(png|jpe?g|gif|webp)$/i.test(f.name) ? new File([f], `Pasted ${stamp}.${f.name.split(".").pop()}`, { type: f.type }) : f)));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  // Drag and drop onto the whole section; the counter stops the highlight flickering over child elements
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => canContribute && Array.from(e.dataTransfer.types).includes("Files");
  const dropProps = {
    onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); },
    onDragOver: (e: React.DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
    onDragLeave: (e: React.DragEvent) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const [fileToDelete, setFileToDelete] = useState<Attachment | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // Thumbnails that failed to load (old or missing file) fall back to the file icon
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());

  const handleDelete = async (id: string) => {
    setFileToDelete(null);
    try {
      await api.deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success("File deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    }
  };

  return (
    <div className="relative space-y-4" data-drop-zone {...dropProps}>
      {dragging && (
        <div className="absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/80 flex items-center justify-center pointer-events-none" data-drop-overlay>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Drop files to upload</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-indigo-500" />
          Attachments
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({attachments.length})</span>
        </h3>
        {canContribute && <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
          Upload File
        </button>}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={ACCEPTED_FILES}
          multiple
          className="hidden"
        />
      </div>

      {attachments.length === 0 && !isUploading ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Paperclip className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">No attachments yet</p>
          {canContribute && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Drag files here, or paste with Ctrl+V</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="group relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(attachments.indexOf(file))}
                aria-label={`Preview ${file.name}`}
                className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {isImage(file) && !brokenThumbs.has(file.id) ? (
                  <img
                    src={fileUrl(file.url)}
                    alt=""
                    loading="lazy"
                    data-thumb={file.id}
                    onError={() => setBrokenThumbs((s) => new Set(s).add(file.id))}
                    className="w-full h-full object-cover"
                  />
                ) : isPdf(file) ? (
                  <span className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-black">PDF</span>
                ) : (
                  getFileIcon(file.fileType)
                )}
              </button>
              <div className="flex-1 min-w-0 pr-16">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(attachments.indexOf(file))}
                  className="block max-w-full text-left text-sm font-bold text-slate-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400"
                  title={file.name}
                >
                  {file.name}
                </button>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatFileSize(file.fileSize)} • {safeFormat(file.createdAt, "MMM d, yyyy")}
                  {file.user && ` • by ${file.user.name}`}
                </p>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <a
                  href={fileUrl(file.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                {(file.userId === currentUser?.id || (canManage ?? isManager(currentUser?.role))) && (
                  <button
                    onClick={() => setFileToDelete(file)}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                    aria-label={`Delete ${file.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewIndex !== null && attachments[previewIndex] && (
        <FilePreview files={attachments} index={previewIndex} onIndex={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
      )}

      <ConfirmDialog
        open={!!fileToDelete}
        title="Delete file?"
        message={fileToDelete ? `"${fileToDelete.name}" will be removed for everyone.` : undefined}
        onConfirm={() => fileToDelete && handleDelete(fileToDelete.id)}
        onCancel={() => setFileToDelete(null)}
      />
    </div>
  );
}
