import {
  createHold,
  confirmAppointment,
  BookingConflictError,
  BookingValidationError,
  HoldExpiredError,
  rateLimit,
  holdBodySchema,
  confirmBodySchema,
} from "@sistema-turnos/api";
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido en la solicitud.", 400);
    }

    const action =
      typeof body === "object" && body !== null && "action" in body
        ? String((body as { action?: string }).action ?? "hold")
        : "hold";

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = await rateLimit(`booking:${tenant.id}:${ip}`, 20, 60);
    if (!limit.allowed) {
      return jsonError("Demasiadas solicitudes", 429);
    }

    if (action === "hold") {
      const parsed = holdBodySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
      }

      const sessionId = parsed.data.sessionId ?? nanoid();
      const result = await createHold({
        tenantSlug,
        staffId: parsed.data.staffId,
        serviceId: parsed.data.serviceId,
        startAt: parsed.data.startAt,
        sessionId,
      });

      return NextResponse.json({
        holdId: result.hold.id,
        expiresAt: result.expiresAt.toISOString(),
        sessionId,
      });
    }

    if (action === "confirm") {
      const parsed = confirmBodySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos.", 400);
      }

      const appointment = await confirmAppointment({
        holdId: parsed.data.holdId,
        clientName: parsed.data.clientName,
        clientEmail: parsed.data.clientEmail || undefined,
        clientPhone: parsed.data.clientPhone,
        notes: parsed.data.notes,
      });

      return NextResponse.json({
        appointmentId: appointment.id,
        publicToken: appointment.publicToken,
        status: appointment.status,
      });
    }

    return jsonError("Acción inválida.", 400);
  } catch (error) {
    if (error instanceof BookingValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof BookingConflictError || error instanceof HoldExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleRouteError(error, "bookings");
  }
}
