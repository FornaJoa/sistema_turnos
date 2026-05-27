import { and, eq } from "drizzle-orm";
import { db, services } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getTenantBySlugFresh } from "@/lib/tenant";
import { requireTenantAdmin } from "@/lib/admin-auth";
import { revalidateTenant } from "@/lib/revalidate";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> }
) {
  const { tenantSlug, serviceId } = await params;
  const auth = await requireTenantAdmin(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenant = await getTenantBySlugFresh(tenantSlug);
  const body = await request.json();

  const existing = await db.query.services.findFirst({
    where: and(eq(services.id, serviceId), eq(services.tenantId, tenant.id)),
  });

  if (!existing) {
    return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
  }

  const priceCents =
    body.pricePesos != null && body.pricePesos !== ""
      ? Math.round(Number(body.pricePesos) * 100)
      : existing.priceCents;

  const [updated] = await db
    .update(services)
    .set({
      name: body.name?.trim() ?? existing.name,
      durationMinutes: Number(body.durationMinutes) || existing.durationMinutes,
      priceCents,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId))
    .returning();

  revalidateTenant(tenantSlug);
  return NextResponse.json({ service: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> }
) {
  const { tenantSlug, serviceId } = await params;
  const auth = await requireTenantAdmin(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenant = await getTenantBySlugFresh(tenantSlug);

  const existing = await db.query.services.findFirst({
    where: and(eq(services.id, serviceId), eq(services.tenantId, tenant.id)),
  });

  if (!existing) {
    return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
  }

  await db
    .update(services)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(services.id, serviceId));

  revalidateTenant(tenantSlug);
  return NextResponse.json({ ok: true });
}
