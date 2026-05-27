import { eq } from "drizzle-orm";
import { db, tenantSettings, tenants } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { revalidateTenant } from "@/lib/revalidate";
import { requireTenantOwner } from "@/lib/admin-auth";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const auth = await requireTenantOwner(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    return NextResponse.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings,
      },
    });
  } catch (error) {
    return handleRouteError(error, "setup/get");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const auth = await requireTenantOwner(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const body = await request.json().catch(() => ({}));
    const brandColor = body.brandColor || body.accentColor || "#4f46e5";

    if (body.name?.trim()) {
      await db
        .update(tenants)
        .set({ name: body.name.trim(), updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));
    }

    const [updated] = await db
      .update(tenantSettings)
      .set({
        logoUrl: body.logoUrl?.trim() || null,
        primaryColor: brandColor,
        accentColor: brandColor,
        welcomeTitle: body.welcomeTitle?.trim() || "Reservá tu turno online",
        welcomeSubtitle:
          body.welcomeSubtitle?.trim() ||
          "Elegí servicio, profesional y el horario que más te convenga.",
        cancellationPolicy:
          body.cancellationPolicy?.trim() ||
          "Podés cancelar hasta 24 horas antes del turno.",
        updatedAt: new Date(),
      })
      .where(eq(tenantSettings.tenantId, tenant.id))
      .returning();

    revalidateTenant(tenantSlug);

    return NextResponse.json({ settings: updated });
  } catch (error) {
    return handleRouteError(error, "setup/patch");
  }
}
