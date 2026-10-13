import React, { useRef, useState, useEffect } from "react";
import { Paperclip, File, X, Download, Trash2, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { api, fileUrl, mapAttachment } from "@/lib/api";
import type { Attachment } from "@/lib/api-types";
import { toast } from "sonner";
import { safeFormat } from "@/utils/dateUtils";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { isManager } from "@/utils/roleUtils";

interface AttachmentSectionProps {
  projectId?: string;
  taskId?: string;
  initialAttachments?: Attachment[];
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes("word") || fileType.includes("officedocument")) return <FileText className="w-5 h-5 text-indigo-500" />;
  return <File className="w-5 h-5 text-slate-500" />;
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

export function AttachmentSection({ projectId, taskId, initialAttachments = NO_ATTACHMENTS }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
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
      api.getAttachments(projectId, taskId).then(setAttachments).catch(console.error);
    }
  }, [projectId, taskId, initialAttachments]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File size exceeds the 10 MB limit");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const newAttachment = await api.uploadAttachment(file, projectId, taskId);
      setAttachments((prev) => 
        prev.some(a => a.id === newAttachment.id) ? prev : [newAttachment, ...prev]
      );
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success("File deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-indigo-500" />
          Attachments
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({attachments.length})</span>
        </h3>
        <button
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
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={ACCEPTED_FILES}
          className="hidden"
        />
      </div>

      {attachments.length === 0 && !isUploading ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Paperclip className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">No attachments yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="group relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                {getFileIcon(file.fileType)}
              </div>
              <div className="flex-1 min-w-0 pr-16">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                  {file.name}
                </p>
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
                {(file.userId === currentUser?.id || isManager(currentUser?.role)) && (
                  <button
                    onClick={() => handleDelete(file.id)}
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
    </div>
  );
}
