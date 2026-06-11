import { and, asc, eq, gte } from "drizzle-orm";
import { db, withDbTransaction, scheduleExceptions, staff } from "@sistema-turnos/db";

export type ScheduleExceptionInput = {
  date: string;
  isClosed: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
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

export function validateScheduleExceptions(exceptions: ScheduleExceptionInput[]) {
  for (const exception of exceptions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date)) {
      throw new Error("Invalid date");
    }
    if (!exception.isClosed) {
      if (!exception.startTime || !exception.endTime) {
        throw new Error("Custom hours require startTime and endTime");
      }
      const start = normalizeTime(exception.startTime);
      const end = normalizeTime(exception.endTime);
      if (start >= end) {
        throw new Error("startTime must be before endTime");
      }
    }
  }
}

export async function getStaffScheduleExceptions(
  tenantId: string,
  staffId: string,
  fromDate?: string
) {
  const from = fromDate ?? new Date().toISOString().slice(0, 10);

  return db.query.scheduleExceptions.findMany({
    where: and(
      eq(scheduleExceptions.tenantId, tenantId),
      eq(scheduleExceptions.staffId, staffId),
      gte(scheduleExceptions.date, from)
    ),
    orderBy: [asc(scheduleExceptions.date)],
  });
}

export async function replaceStaffScheduleExceptions(
  tenantId: string,
  staffId: string,
  exceptions: ScheduleExceptionInput[]
) {
  const member = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)),
  });

  if (!member) {
    throw new Error("Staff not found");
  }

  validateScheduleExceptions(exceptions);

  return withDbTransaction(async (tx) => {
    await tx
      .delete(scheduleExceptions)
      .where(
        and(eq(scheduleExceptions.tenantId, tenantId), eq(scheduleExceptions.staffId, staffId))
      );

    if (exceptions.length === 0) {
      return [];
    }

    return tx
      .insert(scheduleExceptions)
      .values(
        exceptions.map((exception) => ({
          tenantId,
          staffId,
          date: exception.date,
          isClosed: exception.isClosed,
          startTime:
            !exception.isClosed && exception.startTime
              ? normalizeTime(exception.startTime)
              : null,
          endTime:
            !exception.isClosed && exception.endTime
              ? normalizeTime(exception.endTime)
              : null,
          reason: exception.reason?.trim() || null,
        }))
      )
      .returning();
  });
}
