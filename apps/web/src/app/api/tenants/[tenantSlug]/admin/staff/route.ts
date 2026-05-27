import { eq } from "drizzle-orm";
import { db, staff, services, staffServices, schedules } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant } from "@sistema-turnos/api";
import { findTenantBySlug } from "@/lib/tenant";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const session = await getSession();
    const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

    if (!membership || !["admin", "owner"].includes(membership.role)) {
      return jsonError("Debés iniciar sesión como admin o dueño.", 401);
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return jsonError("El nombre es obligatorio.", 400);
    }

    const [created] = await db
      .insert(staff)
      .values({
        tenantId: tenant.id,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
      })
      .returning();

    const tenantServices = await db.query.services.findMany({
      where: eq(services.tenantId, tenant.id),
    });

    for (const service of tenantServices) {
      await db.insert(staffServices).values({
        staffId: created.id,
        serviceId: service.id,
      });
    }

    for (let day = 1; day <= 5; day++) {
      await db.insert(schedules).values({
        tenantId: tenant.id,
        staffId: created.id,
        dayOfWeek: day,
        startTime: "09:00:00",
        endTime: "18:00:00",
      }).onConflictDoNothing({
        target: [schedules.staffId, schedules.dayOfWeek, schedules.startTime, schedules.endTime],
      });
    }

    revalidateTenant(tenantSlug);

    return NextResponse.json({ staff: created });
  } catch (error) {
    return handleRouteError(error, "admin/staff/post");
  }
}
