import {
  createWalkInAppointment,
  getStaffAvailabilitySummary,
  updateAppointmentStatus,
  BookingConflictError,
  BookingValidationError,
  AppointmentStatusError,
  getMembershipForTenant,
  walkInSchema,
  appointmentStatusSchema,
} from "@sistema-turnos/api";
import { and, eq, gte, lt } from "drizzle-orm";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { db, appointments, staff } from "@sistema-turnos/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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

    const catalog = await getTenantCatalogForApi(tenantSlug, true);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    const { searchParams } = new URL(request.url);
    const timezone = catalog.tenant.timezone;
    const date = searchParams.get("date");

    if (date) {
      const summary = await getStaffAvailabilitySummary(
        catalog.tenant.id,
        timezone,
        date
      );
      return NextResponse.json({ summary });
    }

    const day = searchParams.get("day") ?? getTodayDateString(timezone);
    const dayStart = fromZonedTime(`${day}T00:00:00`, timezone);
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
  } catch (error) {
    return handleRouteError(error, "appointments/get");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const session = await getSession();
    const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

    if (!membership || !["reception", "admin", "owner"].includes(membership.role)) {
      return jsonError("Debés iniciar sesión.", 401);
    }

    const body = await request.json().catch(() => null);
    const parsed = walkInSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    try {
      const appointment = await createWalkInAppointment({
        tenantSlug,
        staffId: parsed.data.staffId,
        serviceId: parsed.data.serviceId,
        startAt: parsed.data.startAt,
        clientName: parsed.data.clientName,
        clientEmail: parsed.data.clientEmail || undefined,
        clientPhone: parsed.data.clientPhone,
        notes: parsed.data.notes,
        createdByUserId: session?.user.id,
      });

      return NextResponse.json({ appointment });
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return jsonError(error.message, 400);
      }
      if (error instanceof BookingConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error, "appointments/post");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const session = await getSession();
    const membership = session ? getMembershipForTenant(session, tenantSlug) : undefined;

    if (!membership) {
      return jsonError("Debés iniciar sesión.", 401);
    }

    const body = await request.json().catch(() => null);
    const parsed = appointmentStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
    }

    const catalog = await getTenantCatalogForApi(tenantSlug, true);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, parsed.data.appointmentId),
        eq(appointments.tenantId, catalog.tenant.id)
      ),
    });

    if (!appointment) {
      return jsonError("Turno no encontrado.", 404);
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
        return jsonError("No podés modificar este turno.", 403);
      }
    } else if (!["reception", "admin", "owner"].includes(membership.role)) {
      return jsonError("Debés iniciar sesión.", 401);
    }

    const updated = await updateAppointmentStatus(
      parsed.data.appointmentId,
      parsed.data.status,
      session?.user.id
    );

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    if (error instanceof AppointmentStatusError) {
      return jsonError(error.message, 409);
    }
    return handleRouteError(error, "appointments/patch");
  }
}
