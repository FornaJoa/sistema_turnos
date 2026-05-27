import { cleanupExpiredHolds, sendReminderNotifications } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return jsonError("CRON_SECRET no configurado.", 503);
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return jsonError("No autorizado.", 401);
    }

    await cleanupExpiredHolds();
    await sendReminderNotifications();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "cron/reminders");
  }
}
