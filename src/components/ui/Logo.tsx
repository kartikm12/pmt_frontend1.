import React from "react";
import { cn } from "@/lib/utils";
import companyLogo from "@/entrolabscropped.png";
import companyLogoBlack from "@/logo-black.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  light?: boolean;
  variant?: "default" | "black";
}

export function Logo({ className, size = "md", light = false, variant = "default" }: LogoProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-12",
    lg: "h-20"
  };

  const imgClass = cn("w-auto max-w-[220px] object-contain", light ? "invert" : "", sizeClasses[size]);
  return (
    <div className={cn("flex items-center justify-center p-2", className)}>
      {variant === "black" ? (
        <>
          {/* The black logo vanishes on a dark background: dark theme shows the white one (as the sidebar does) */}
          <img src={companyLogoBlack} alt="Entro Labs" data-logo="light-theme" className={cn(imgClass, "dark:hidden")} />
          <img src={companyLogo} alt="Entro Labs" data-logo="dark-theme" className={cn(imgClass, "hidden dark:block")} />
        </>
      ) : (
        <img src={companyLogo} alt="Entro Labs" className={imgClass} />
      )}
    </div>
  );
}
