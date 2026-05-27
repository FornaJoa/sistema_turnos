import {
  createWalkInAppointment,
  getStaffAvailabilitySummary,
  updateAppointmentStatus,
  BookingConflictError,
} from "@sistema-turnos/api";
import { and, eq, gte, lt } from "drizzle-orm";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { db, appointments, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMembershipForTenant } from "@sistema-turnos/api";
import { getCachedTenantCatalog } from "@/lib/catalog";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const catalog = await getCachedTenantCatalog(tenantSlug);
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (date) {
    const summary = await getStaffAvailabilitySummary(
      catalog.tenant.id,
      catalog.tenant.timezone,
      date
    );
    return NextResponse.json({ summary });
  }

  const day = searchParams.get("day") ?? new Date().toISOString().slice(0, 10);
  const dayStart = fromZonedTime(`${day}T00:00:00`, catalog.tenant.timezone);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const dayAppointments = await db.query.appointments.findMany({
    where: and(
      eq(appointments.tenantId, catalog.tenant.id),
      gte(appointments.startAt, dayStart),
      lt(appointments.startAt, dayEnd)
    ),
    with: { staff: true, service: true },
    orderBy: (a, { asc }) => [asc(a.startAt)],
  });

  return NextResponse.json({ appointments: dayAppointments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const session = await getSession();
  const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

  if (!membership || !["reception", "admin", "owner"].includes(membership.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const appointment = await createWalkInAppointment({
      tenantSlug,
      staffId: body.staffId,
      serviceId: body.serviceId,
      startAt: body.startAt,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientPhone: body.clientPhone,
      notes: body.notes,
      createdByUserId: session?.user.id,
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const session = await getSession();
  const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const catalog = await getCachedTenantCatalog(tenantSlug);

  const appointment = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.id, body.appointmentId),
      eq(appointments.tenantId, catalog.tenant.id)
    ),
  });

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
  }

  if (membership.role === "staff") {
    const staffProfile = await db.query.staff.findFirst({
      where: and(
        eq(staff.tenantId, catalog.tenant.id),
        eq(staff.userId, session!.user.id),
        eq(staff.isActive, true)
      ),
    });

    if (!staffProfile || appointment.staffId !== staffProfile.id) {
      return NextResponse.json({ error: "No podés modificar este turno." }, { status: 403 });
    }
  } else if (!["reception", "admin", "owner"].includes(membership.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await updateAppointmentStatus(
    body.appointmentId,
    body.status,
    session?.user.id
  );

  return NextResponse.json({ appointment: updated });
}
