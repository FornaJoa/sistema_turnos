import type { MembershipRole } from "./types";

const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  staff: 1,
  reception: 2,
  admin: 3,
  owner: 4,
};

export function hasMinimumRole(
  userRole: MembershipRole,
  requiredRole: MembershipRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const PERMISSIONS = {
  manageAppointments: ["reception", "admin", "owner"] as MembershipRole[],
  manageStaff: ["admin", "owner"] as MembershipRole[],
  manageServices: ["admin", "owner"] as MembershipRole[],
  manageTheme: ["owner"] as MembershipRole[],
  viewAnalytics: ["owner"] as MembershipRole[],
  manageOwnAppointments: ["staff", "reception", "admin", "owner"] as MembershipRole[],
};

export function canAccess(
  userRole: MembershipRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].some((role) => hasMinimumRole(userRole, role));
}
