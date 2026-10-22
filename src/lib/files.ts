// Upload rules shared by the Files tab and the comment box; they mirror the server (utils/multer.ts)
export const ACCEPTED_FILES = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.ppt,.pptx,.doc,.docx,.xls,.xlsx";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_COMMENT_FILES = 5;

// Why a file can't be uploaded, or null when it can
export function fileProblem(file: File, several = false): string | null {
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
  if (!ACCEPTED_FILES.split(",").includes(ext)) return `"${file.name}" isn't a file type PMT accepts`;
  if (file.size > MAX_FILE_BYTES) return several ? `"${file.name}" is over the 10 MB limit` : "File size exceeds the 10 MB limit";
  if (!file.size) return `"${file.name}" is empty`;
  return null;
}

// Screenshots arrive from the clipboard as "image.png"; give them a dated name so several stay apart
export function namePasted(files: File[]): File[] {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
  return files.map((f, i) =>
    /^image\.(png|jpe?g|gif|webp)$/i.test(f.name)
      ? new File([f], `Pasted ${stamp}${files.length > 1 ? ` (${i + 1})` : ""}.${f.name.split(".").pop()}`, { type: f.type })
      : f
  );
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
