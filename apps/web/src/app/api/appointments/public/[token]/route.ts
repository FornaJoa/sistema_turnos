import {
  getAppointmentByPublicToken,
  updateAppointmentStatus,
  AppointmentStatusError,
  publicCancelSchema,
} from "@sistema-turnos/api";
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

    const body = await request.json().catch(() => null);
    const parsed = publicCancelSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Acción no válida.", 400);
    }

    if (!["pending", "confirmed"].includes(appointment.status)) {
      return jsonError("Este turno ya no se puede cancelar.", 409);
    }

    const cancellationHours = appointment.tenant.settings?.cancellationHours ?? 24;
    const hoursUntil =
      (new Date(appointment.startAt).getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntil < cancellationHours) {
      return jsonError(
        `Solo podés cancelar hasta ${cancellationHours} horas antes del turno.`,
        409
      );
    }

    const updated = await updateAppointmentStatus(appointment.id, "cancelled");
    return NextResponse.json({ appointment: updated });
  } catch (error) {
    if (error instanceof AppointmentStatusError) {
      return jsonError(error.message, 409);
    }
    return handleRouteError(error, "appointments/public/patch");
  }
}
