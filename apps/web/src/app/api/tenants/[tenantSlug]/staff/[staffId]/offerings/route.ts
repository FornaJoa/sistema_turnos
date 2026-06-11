import {
  listStaffServiceOfferings,
  updateStaffServiceOfferings,
  invalidateAvailabilityCache,
  offeringsPatchSchema,
} from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantMembership } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getTodayDateString } from "@/lib/utils";

async function assertCanManageStaffOfferings(
  tenantSlug: string,
  staffId: string
) {
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
    return { error: "No tenés permiso para editar estos servicios.", status: 403 as const };
  }

  return { tenant, staffMember, session: auth.session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffOfferings(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const offerings = await listStaffServiceOfferings(access.tenant.id, staffId);
    return NextResponse.json({ offerings });
  } catch (error) {
    return handleRouteError(error, "staff/offerings/get");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffOfferings(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = offeringsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    try {
      const offerings = await updateStaffServiceOfferings(
        access.tenant.id,
        staffId,
        parsed.data.offerings
      );

      const dateKey = getTodayDateString(access.tenant.timezone);
      const serviceIds = offerings.map((offering) => offering.serviceId);
      await invalidateAvailabilityCache(
        access.tenant.id,
        staffId,
        dateKey,
        undefined,
        serviceIds
      );

      revalidateTenant(tenantSlug);

      return NextResponse.json({ offerings });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid")) {
        return jsonError("Datos de servicio inválidos.", 400);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error, "staff/offerings/patch");
  }
}
