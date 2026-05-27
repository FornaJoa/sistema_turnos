import { and, eq, gte } from "drizzle-orm";
import { db, appointments, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getTenantBySlugFresh } from "@/lib/tenant";
import { requireTenantStaffOrAbove } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string; staffId: string }> }
) {
  const { tenantSlug, staffId } = await params;
  const auth = await requireTenantStaffOrAbove(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenant = await getTenantBySlugFresh(tenantSlug);

  if (auth.membership!.role === "staff") {
    const staffProfile = await db.query.staff.findFirst({
      where: and(
        eq(staff.tenantId, tenant.id),
        eq(staff.userId, auth.session!.user.id),
        eq(staff.isActive, true)
      ),
    });

    if (!staffProfile || staffProfile.id !== staffId) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
  }

  const staffAppointments = await db.query.appointments.findMany({
    where: and(
      eq(appointments.tenantId, tenant.id),
      eq(appointments.staffId, staffId),
      gte(appointments.startAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
    ),
    with: { service: true, staff: true },
    orderBy: (a, { asc }) => [asc(a.startAt)],
  });

  return NextResponse.json({ appointments: staffAppointments });
}
