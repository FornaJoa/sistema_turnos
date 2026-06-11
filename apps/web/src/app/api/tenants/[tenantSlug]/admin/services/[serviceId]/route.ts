import { servicePatchSchema } from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, services, staffServices } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantAdmin } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> }
) {
  try {
    const { tenantSlug, serviceId } = await params;
    const auth = await requireTenantAdmin(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const body = await request.json().catch(() => null);
    const parsed = servicePatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    const existing = await db.query.services.findFirst({
      where: and(eq(services.id, serviceId), eq(services.tenantId, tenant.id)),
    });

    if (!existing) {
      return jsonError("Servicio no encontrado.", 404);
    }

    const priceCents =
      parsed.data.pricePesos != null
        ? Math.round(parsed.data.pricePesos * 100)
        : existing.priceCents;

    const [updated] = await db
      .update(services)
      .set({
        name: parsed.data.name?.trim() ?? existing.name,
        durationMinutes: parsed.data.durationMinutes ?? existing.durationMinutes,
        priceCents,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceId))
      .returning();

    revalidateTenant(tenantSlug);
    return NextResponse.json({ service: updated });
  } catch (error) {
    return handleRouteError(error, "admin/services/patch");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> }
) {
  try {
    const { tenantSlug, serviceId } = await params;
    const auth = await requireTenantAdmin(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const existing = await db.query.services.findFirst({
      where: and(eq(services.id, serviceId), eq(services.tenantId, tenant.id)),
    });

    if (!existing) {
      return jsonError("Servicio no encontrado.", 404);
    }

    await db
      .update(services)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(services.id, serviceId));

    await db.delete(staffServices).where(eq(staffServices.serviceId, serviceId));

    revalidateTenant(tenantSlug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "admin/services/delete");
  }
}
