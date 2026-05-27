import { and, eq } from "drizzle-orm";
import { db, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getTenantBySlugFresh } from "@/lib/tenant";
import { requireTenantStaffOrAbove } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await requireTenantStaffOrAbove(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenant = await getTenantBySlugFresh(tenantSlug);

  const staffProfile = await db.query.staff.findFirst({
    where: and(eq(staff.tenantId, tenant.id), eq(staff.userId, auth.session!.user.id), eq(staff.isActive, true)),
  });

  return NextResponse.json({
    user: auth.session!.user,
    membership: auth.membership,
    staffProfile,
    tenant: { name: tenant.name, timezone: tenant.timezone },
  });
}
