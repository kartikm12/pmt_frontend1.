import React from "react";

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

  // Always show initials as per user request
  const initials = getInitials(name || "");
  
  // Define default classes but allow them to be overridden or supplemented by className.
  const baseClasses = "flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300";

  return (
    <div className={`${baseClasses} ${className}`} title={name} {...props}>
      {initials}
    </div>
  );
}
