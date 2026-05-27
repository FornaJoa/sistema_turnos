import { getAppointmentByPublicToken, updateAppointmentStatus } from "@sistema-turnos/api";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appointment = await getAppointmentByPublicToken(token);

  if (!appointment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ appointment });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appointment = await getAppointmentByPublicToken(token);

  if (!appointment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  if (body.action === "cancel") {
    const updated = await updateAppointmentStatus(appointment.id, "cancelled");
    return NextResponse.json({ appointment: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
