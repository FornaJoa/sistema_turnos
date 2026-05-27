import { createHold, confirmAppointment, BookingConflictError, HoldExpiredError } from "@sistema-turnos/api";
import { rateLimit } from "@sistema-turnos/api";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { getTenantBySlug } from "@/lib/tenant";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  const body = await request.json();
  const action = String(body.action ?? "hold");

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = await rateLimit(`booking:${tenant.id}:${ip}`, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  try {
    if (action === "hold") {
      const sessionId = body.sessionId ?? nanoid();
      const result = await createHold({
        tenantSlug,
        staffId: body.staffId,
        serviceId: body.serviceId,
        startAt: body.startAt,
        sessionId,
      });

      return NextResponse.json({
        holdId: result.hold.id,
        expiresAt: result.expiresAt.toISOString(),
        sessionId,
      });
    }

    if (action === "confirm") {
      const appointment = await confirmAppointment({
        holdId: body.holdId,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        notes: body.notes,
      });

      return NextResponse.json({
        appointmentId: appointment.id,
        publicToken: appointment.publicToken,
        status: appointment.status,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof BookingConflictError || error instanceof HoldExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[bookings]", error);
    return NextResponse.json({ error: "No se pudo procesar la reserva." }, { status: 500 });
  }
}
