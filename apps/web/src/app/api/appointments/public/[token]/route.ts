import { getAppointmentByPublicToken, updateAppointmentStatus } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const appointment = await getAppointmentByPublicToken(token);

    if (!appointment) {
      return jsonError("Turno no encontrado.", 404);
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return handleRouteError(error, "appointments/public/get");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const appointment = await getAppointmentByPublicToken(token);

    if (!appointment) {
      return jsonError("Turno no encontrado.", 404);
    }

    const body = await request.json().catch(() => ({}));
    if (body.action === "cancel") {
      const updated = await updateAppointmentStatus(appointment.id, "cancelled");
      return NextResponse.json({ appointment: updated });
    }

    return jsonError("Acción no válida.", 400);
  } catch (error) {
    return handleRouteError(error, "appointments/public/patch");
  }
}
