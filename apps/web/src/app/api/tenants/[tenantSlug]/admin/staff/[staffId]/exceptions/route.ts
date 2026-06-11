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
import { requireTenantAdmin } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getTodayDateString } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const auth = await requireTenantAdmin(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const member = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id)),
    });

    if (!member) {
      return jsonError("Profesional no encontrado.", 404);
    }

    const exceptions = await getStaffScheduleExceptions(tenant.id, staffId);
    return NextResponse.json({ exceptions });
  } catch (error) {
    return handleRouteError(error, "admin/staff/exceptions/get");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  try {
    const { tenantSlug, staffId } = await params;
    const auth = await requireTenantAdmin(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const member = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id)),
    });

    if (!member) {
      return jsonError("Profesional no encontrado.", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = scheduleExceptionsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    try {
      const exceptions = await replaceStaffScheduleExceptions(
        tenant.id,
        staffId,
        parsed.data.exceptions
      );
      const dateKey = getTodayDateString(tenant.timezone);
      await invalidateAvailabilityCache(tenant.id, staffId, dateKey);
      revalidateTenant(tenantSlug);
      return NextResponse.json({ exceptions });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid")) {
        return jsonError("Excepciones inválidas.", 400);
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error, "admin/staff/exceptions/put");
  }
}
