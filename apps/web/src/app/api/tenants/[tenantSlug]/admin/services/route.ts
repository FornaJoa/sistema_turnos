import { db, services, staffServices, staff } from "@sistema-turnos/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant } from "@sistema-turnos/api";
import { getTenantBySlugFresh } from "@/lib/tenant";
import { revalidateTenant } from "@/lib/revalidate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const session = await getSession();
  const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

  if (!membership || !["admin", "owner"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Debés iniciar sesión como admin o dueño." },
      { status: 401 }
    );
  }

  const tenant = await getTenantBySlugFresh(tenantSlug);
  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const durationMinutes = Number(body.durationMinutes) || 30;
  const priceCents = body.pricePesos != null ? Math.round(Number(body.pricePesos) * 100) : null;

  const [created] = await db
    .insert(services)
    .values({
      tenantId: tenant.id,
      name: body.name.trim(),
      durationMinutes,
      priceCents,
    })
    .returning();

  const staffMembers = await db.query.staff.findMany({
    where: eq(staff.tenantId, tenant.id),
  });

  for (const member of staffMembers) {
    await db.insert(staffServices).values({
      staffId: member.id,
      serviceId: created.id,
    });
  }

  revalidateTenant(tenantSlug);

  return NextResponse.json({ service: created });
}
