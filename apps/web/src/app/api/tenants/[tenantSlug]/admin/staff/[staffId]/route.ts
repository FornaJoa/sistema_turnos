import { and, eq } from "drizzle-orm";
import { db, staff, staffServices } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantAdmin } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function PATCH(
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

    const body = await request.json().catch(() => ({}));

    const existing = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id)),
    });

    if (!existing) {
      return jsonError("Profesional no encontrado.", 404);
    }

    const [updated] = await db
      .update(staff)
      .set({
        name: body.name?.trim() ?? existing.name,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId))
      .returning();

    if (Array.isArray(body.serviceIds)) {
      await db.delete(staffServices).where(eq(staffServices.staffId, staffId));
      for (const serviceId of body.serviceIds) {
        await db.insert(staffServices).values({ staffId, serviceId });
      }
    }

    revalidateTenant(tenantSlug);
    return NextResponse.json({ staff: updated });
  } catch (error) {
    return handleRouteError(error, "admin/staff/patch");
  }
}

export async function DELETE(
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

    const existing = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id)),
    });

    if (!existing) {
      return jsonError("Profesional no encontrado.", 404);
    }

    await db
      .update(staff)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staff.id, staffId));

    revalidateTenant(tenantSlug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "admin/staff/delete");
  }
}
