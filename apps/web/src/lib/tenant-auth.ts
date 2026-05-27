import {
  getMembershipForTenant,
  hasMinimumRole,
  type MembershipRole,
} from "@sistema-turnos/api";
import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { getDefaultPanelPath } from "./panel-access";

export async function requireTenantAccess(
  tenantSlug: string,
  minimumRole: MembershipRole = "reception"
) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=/${tenantSlug}/${minimumRole === "staff" ? "barbero" : minimumRole === "reception" ? "reception" : minimumRole === "owner" ? "owner" : "admin"}`);
  }

  const membership = getMembershipForTenant(session, tenantSlug);
  if (!membership) {
    redirect("/");
  }

  if (!hasMinimumRole(membership.role, minimumRole)) {
    redirect(getDefaultPanelPath(tenantSlug, membership.role));
  }

  return { session, membership };
}

export async function requireStaffPanel(tenantSlug: string) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=/${tenantSlug}/barbero`);
  }

  const membership = getMembershipForTenant(session, tenantSlug);
  if (!membership) {
    redirect("/");
  }

  if (membership.role !== "staff" && !hasMinimumRole(membership.role, "reception")) {
    redirect(getDefaultPanelPath(tenantSlug, membership.role));
  }

  return { session, membership };
}

export async function requireOwnerPanel(tenantSlug: string) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=/${tenantSlug}/owner`);
  }

  const membership = getMembershipForTenant(session, tenantSlug);
  if (!membership || membership.role !== "owner") {
    redirect(membership ? getDefaultPanelPath(tenantSlug, membership.role) : "/");
  }

  return { session, membership };
}

export async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session?.user.isPlatformAdmin) {
    redirect("/login");
  }
  return session;
}
