import { createHold, confirmAppointment, BookingConflictError, HoldExpiredError } from "@sistema-turnos/api";
import { rateLimit } from "@sistema-turnos/api";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido en la solicitud.", 400);
    }

    const action = String(body.action ?? "hold");

    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limit = await rateLimit(`booking:${tenant.id}:${ip}`, 20, 60);
    if (!limit.allowed) {
      return jsonError("Demasiadas solicitudes", 429);
    }

    if (action === "hold") {
      const sessionId = String(body.sessionId ?? nanoid());
      const result = await createHold({
        tenantSlug,
        staffId: String(body.staffId ?? ""),
        serviceId: String(body.serviceId ?? ""),
        startAt: String(body.startAt ?? ""),
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
        holdId: String(body.holdId ?? ""),
        clientName: String(body.clientName ?? ""),
        clientEmail: body.clientEmail ? String(body.clientEmail) : undefined,
        clientPhone: body.clientPhone ? String(body.clientPhone) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
      });

      return NextResponse.json({
        appointmentId: appointment.id,
        publicToken: appointment.publicToken,
        status: appointment.status,
      });
    }

    return jsonError("Acción inválida.", 400);
  } catch (error) {
    if (error instanceof BookingConflictError || error instanceof HoldExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleRouteError(error, "bookings");
  }
}
