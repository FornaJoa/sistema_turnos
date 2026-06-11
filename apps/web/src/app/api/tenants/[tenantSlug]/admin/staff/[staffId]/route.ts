import { assertServiceIdsForTenant, BookingValidationError, staffPatchSchema } from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, staff, staffServices, withDbTransaction } from "@sistema-turnos/db";
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

    const body = await request.json().catch(() => null);
    const parsed = staffPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    const existing = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenant.id)),
    });

    if (!existing) {
      return jsonError("Profesional no encontrado.", 404);
    }

    const [updated] = await db
      .update(staff)
      .set({
        name: parsed.data.name?.trim() ?? existing.name,
        email: parsed.data.email?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, staffId))
      .returning();

    if (parsed.data.serviceIds) {
      const serviceIds = parsed.data.serviceIds;
      try {
        await assertServiceIdsForTenant(tenant.id, serviceIds);
      } catch (error) {
        if (error instanceof BookingValidationError) {
          return jsonError(error.message, 400);
        }
        throw error;
      }

      await withDbTransaction(async (tx) => {
        const existingLinks = await tx.query.staffServices.findMany({
          where: eq(staffServices.staffId, staffId),
        });
        type StaffServiceLink = (typeof existingLinks)[number];
        const existingByService = new Map(
          existingLinks.map((link: StaffServiceLink) => [link.serviceId, link])
        );
        const selected = new Set(serviceIds);

        for (const link of existingLinks) {
          if (!selected.has(link.serviceId)) {
            await tx.delete(staffServices).where(eq(staffServices.id, link.id));
          }
        }

        for (const serviceId of serviceIds) {
          if (!existingByService.has(serviceId)) {
            await tx.insert(staffServices).values({ staffId, serviceId });
          }
        }
      });
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
