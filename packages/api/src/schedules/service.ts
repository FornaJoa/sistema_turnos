import { and, asc, eq } from "drizzle-orm";
import { db, withDbTransaction, schedules, staff } from "@sistema-turnos/db";

export type ScheduleWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function normalizeTime(value: string) {
  const parts = value.trim().split(":");
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
  }
  if (parts.length >= 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
  }
  throw new Error("Invalid time format");
}

export async function getStaffSchedules(tenantId: string, staffId: string) {
  return db.query.schedules.findMany({
    where: and(
      eq(schedules.tenantId, tenantId),
      eq(schedules.staffId, staffId),
      eq(schedules.isActive, true)
    ),
    orderBy: [asc(schedules.dayOfWeek), asc(schedules.startTime)],
  });
}

export async function replaceStaffSchedules(
  tenantId: string,
  staffId: string,
  windows: ScheduleWindow[]
) {
  const member = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)),
  });

  if (!member) {
    throw new Error("Staff not found");
  }

  for (const window of windows) {
    if (window.dayOfWeek < 0 || window.dayOfWeek > 6) {
      throw new Error("Invalid dayOfWeek");
    }
    const start = normalizeTime(window.startTime);
    const end = normalizeTime(window.endTime);
    if (start >= end) {
      throw new Error("startTime must be before endTime");
    }
  }

  return withDbTransaction(async (tx) => {
    await tx
      .delete(schedules)
      .where(and(eq(schedules.tenantId, tenantId), eq(schedules.staffId, staffId)));

    if (windows.length === 0) {
      return [];
    }

    return tx
      .insert(schedules)
      .values(
        windows.map((window) => ({
          tenantId,
          staffId,
          dayOfWeek: window.dayOfWeek,
          startTime: normalizeTime(window.startTime),
          endTime: normalizeTime(window.endTime),
          isActive: true,
        }))
      )
      .returning();
  });
}
