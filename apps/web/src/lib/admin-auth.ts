import { getMembershipForTenant, hasMinimumRole, type MembershipRole } from "@sistema-turnos/api";
import { getSession } from "@/lib/auth";

export async function requireTenantMembership(tenantSlug: string) {
  const session = await getSession();
  const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

  if (!membership) {
    return { error: "Debés iniciar sesión.", status: 401 as const };
  }

  return { session, membership };
}

export async function requireTenantMinimumRole(
  tenantSlug: string,
  minimumRole: MembershipRole
) {
  const auth = await requireTenantMembership(tenantSlug);
  if ("error" in auth) {
    return auth;
  }

  if (!hasMinimumRole(auth.membership!.role, minimumRole)) {
    return { error: "No tenés permiso para esta acción.", status: 403 as const };
  }

  return auth;
}

export async function requireTenantAdmin(tenantSlug: string) {
  return requireTenantMinimumRole(tenantSlug, "admin");
}

export async function requireTenantReception(tenantSlug: string) {
  return requireTenantMinimumRole(tenantSlug, "reception");
}

export async function requireTenantOwner(tenantSlug: string) {
  const auth = await requireTenantMembership(tenantSlug);
  if ("error" in auth) {
    return auth;
  }

  if (auth.membership!.role !== "owner") {
    return { error: "Solo el dueño puede acceder.", status: 403 as const };
  }

  return auth;
}

export async function requireTenantStaffOrAbove(tenantSlug: string) {
  return requireTenantMembership(tenantSlug);
}
