import { UserRole } from "@/lib/api-types";

export const MANAGERIAL_ROLES: UserRole[] = [
  "Manager",
  "Project Manager",
  "Admin"
];

export function isManager(role?: string): boolean {
  if (!role) return false;
  return MANAGERIAL_ROLES.includes(role as UserRole);
}
