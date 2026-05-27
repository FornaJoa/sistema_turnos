import { eq } from "drizzle-orm";
import { db, tenantSettings } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant } from "@sistema-turnos/api";
import { findTenantBySlug } from "@/lib/tenant";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const session = await getSession();
    const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

    if (!membership || membership.role !== "owner") {
      return jsonError("Debés iniciar sesión como dueño.", 401);
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const body = await request.json().catch(() => ({}));

    const [updated] = await db
      .update(tenantSettings)
      .set({
        logoUrl: body.logoUrl,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        accentColor: body.accentColor,
        fontFamily: body.fontFamily,
        welcomeTitle: body.welcomeTitle,
        welcomeSubtitle: body.welcomeSubtitle,
        cancellationPolicy: body.cancellationPolicy,
        whatsappEnabled: body.whatsappEnabled,
        updatedAt: new Date(),
      })
      .where(eq(tenantSettings.tenantId, tenant.id))
      .returning();

    return NextResponse.json({ settings: updated });
  } catch (error) {
    return handleRouteError(error, "theme/patch");
  }
}
