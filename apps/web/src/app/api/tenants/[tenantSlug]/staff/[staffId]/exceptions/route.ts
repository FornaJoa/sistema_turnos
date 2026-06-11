import {
  getStaffScheduleExceptions,
  replaceStaffScheduleExceptions,
  invalidateAvailabilityCache,
  scheduleExceptionsPatchSchema,
} from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantMembership } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getTodayDateString } from "@/lib/utils";

async function assertCanManageStaffExceptions(tenantSlug: string, staffId: string) {
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
    return { error: "No tenés permiso para editar estas excepciones.", status: 403 as const };
  }

  return { tenant, staffMember };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffExceptions(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const exceptions = await getStaffScheduleExceptions(access.tenant.id, staffId);
    return NextResponse.json({ exceptions });
  } catch (error) {
    return handleRouteError(error, "staff/exceptions/get");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const access = await assertCanManageStaffExceptions(tenantSlug, staffId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = scheduleExceptionsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    try {
      const exceptions = await replaceStaffScheduleExceptions(
        access.tenant.id,
        staffId,
        parsed.data.exceptions
      );
      const dateKey = getTodayDateString(access.tenant.timezone);
      await invalidateAvailabilityCache(access.tenant.id, staffId, dateKey);
      revalidateTenant(tenantSlug);
      return NextResponse.json({ exceptions });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid")) {
        return jsonError("Excepciones inválidas.", 400);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error, "staff/exceptions/put");
  }
}
