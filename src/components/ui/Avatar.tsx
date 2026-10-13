import React, { useEffect, useState } from "react";
import { fileUrl } from "@/lib/api";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string | null;
  className?: string;
  key?: React.Key;
}

export function Avatar({ name, src, className = "", ...props }: AvatarProps) {
  const getInitials = (fullName: string) => {
    if (!fullName) return "U";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Show the uploaded photo; fall back to initials when there is none or it fails to load
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const photo = src?.trim() && !failed ? fileUrl(src.trim()) : null;

  const initials = getInitials(name || "");

  // Define default classes but allow them to be overridden or supplemented by className.
  const baseClasses = "flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300 overflow-hidden";

  return (
    <div className={`${baseClasses} ${className}`} title={name} {...props}>
      {photo ? (
        <img src={photo} alt={name ? `${name}'s photo` : "Profile photo"} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </div>
  );
}
