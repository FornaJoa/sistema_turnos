import { db, services, staffServices, staff } from "@sistema-turnos/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant, serviceCreateSchema, servicePatchSchema } from "@sistema-turnos/api";
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

    const body = await request.json().catch(() => null);
    const parsed = serviceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    const durationMinutes = parsed.data.durationMinutes ?? 30;
    const priceCents =
      parsed.data.pricePesos != null ? Math.round(parsed.data.pricePesos * 100) : null;

    const [created] = await db
      .insert(services)
      .values({
        tenantId: tenant.id,
        name: parsed.data.name.trim(),
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
  } catch (error) {
    return handleRouteError(error, "admin/services/post");
  }
}
