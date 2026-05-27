export type MembershipRole = "owner" | "admin" | "reception" | "staff";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: MembershipRole;
}

export interface AuthSession {
  user: SessionUser;
  memberships: TenantMembership[];
  activeTenantId?: string;
}
