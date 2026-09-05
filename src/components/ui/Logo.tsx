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

  return (
    <div className={cn("flex items-center justify-center p-2", className)}>
      <img
        src={variant === "black" ? companyLogoBlack : companyLogo}
        alt="Entro Labs"
        className={cn(
          "w-auto max-w-[220px] object-contain",
          light ? "invert" : "",
          sizeClasses[size]
        )}
      />
    </div>
  );
}
