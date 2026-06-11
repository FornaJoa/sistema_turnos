import { getAvailableSlots, getStaffAvailabilitySummary } from "@sistema-turnos/api";
import { and, eq, gte, lt } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { db, appointments } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getTenantCatalogForApi } from "@/lib/catalog";
import { requireTenantReception } from "@/lib/admin-auth";
import { handleRouteError, jsonError } from "@/lib/api-route";
import { getTodayDateString } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const auth = await requireTenantReception(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const catalog = await getTenantCatalogForApi(tenantSlug, true);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    const { id: tenantId, timezone } = catalog.tenant;
    const date = searchParams.get("date") ?? getTodayDateString(timezone);
    const walkInStaffId = searchParams.get("staffId");
    const walkInServiceId = searchParams.get("serviceId");

    const dayStart = fromZonedTime(`${date}T00:00:00`, timezone);
    const dayEnd = addMinutes(dayStart, 24 * 60);

    const [summary, dayAppointments, walkInSlots] = await Promise.all([
      getStaffAvailabilitySummary(tenantId, timezone, date),
      db.query.appointments.findMany({
        where: and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, dayStart),
          lt(appointments.startAt, dayEnd)
        ),
        with: { staff: true, service: true },
        orderBy: (a, { asc }) => [asc(a.startAt)],
      }),
      walkInStaffId && walkInServiceId
        ? getAvailableSlots({
            tenantId,
            staffId: walkInStaffId,
            serviceId: walkInServiceId,
            date,
            timezone,
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json(
      { catalog, summary, appointments: dayAppointments, date, walkInSlots },
      { headers: { "Cache-Control": "private, s-maxage=15, stale-while-revalidate=30" } }
    );
  } catch (error) {
    return handleRouteError(error, "reception");
  }
}
