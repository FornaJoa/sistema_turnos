import { eq } from "drizzle-orm";
import { db, tenantSettings } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant } from "@sistema-turnos/api";
import { getTenantBySlug } from "@/lib/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const session = await getSession();
  const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantBySlug(tenantSlug);
  const body = await request.json();

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
}
