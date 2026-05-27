import { sendReminderNotifications } from "@sistema-turnos/api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? "dev-cron"}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendReminderNotifications();
  return NextResponse.json({ ok: true });
}
