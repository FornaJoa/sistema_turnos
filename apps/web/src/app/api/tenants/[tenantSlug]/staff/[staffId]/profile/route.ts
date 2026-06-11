import {
  getStaffPublicProfile,
  updateStaffPublicProfile,
  staffProfilePatchSchema,
} from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantMembership } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";

async function assertCanManageStaffProfile(tenantSlug: string, staffId: string) {
  const auth = await requireTenantMembership(tenantSlug);
  if ("error" in auth) {
    return { error: auth.error, status: auth.status };
  }

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    return { error: "Local no encontrado.", status: 404 as const };
  }

  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id), eq(staff.isActive, true)),
    columns: { id: true, userId: true },
  });

  if (!staffMember) {
    return { error: "Profesional no encontrado.", status: 404 as const };
  }

  const role = auth.membership!.role;
  const isAdmin = ["admin", "owner"].includes(role);
  const isOwnProfile =
    role === "staff" && staffMember.userId === auth.session!.user.id;

  if (!isAdmin && !isOwnProfile) {
    return { error: "No tenés permiso para editar este perfil.", status: 403 as const };
  }

  return { tenant, staffMember };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffProfile(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const profile = await getStaffPublicProfile(access.tenant.id, staffId);
    if (!profile) {
      return jsonError("Profesional no encontrado.", 404);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return handleRouteError(error, "staff/profile/get");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffProfile(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = staffProfilePatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    const profile = await updateStaffPublicProfile(access.tenant.id, staffId, parsed.data);
    revalidateTenant(tenantSlug);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleRouteError(error, "staff/profile/patch");
  }
}
