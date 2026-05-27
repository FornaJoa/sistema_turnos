import {
  addMinutes,
  areIntervalsOverlapping,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { and, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import {
  db,
  appointmentHolds,
  appointments,
  scheduleExceptions,
  schedules,
  services,
  staff,
  tenantSettings,
} from "@sistema-turnos/db";
import {
  buildAvailabilityCacheKey,
  buildAvailabilitySummaryCacheKey,
  getCachedAvailability,
  invalidateAvailabilityCache,
  setCachedAvailability,
} from "../cache/redis";

export interface TimeSlot {
  startAt: string;
  endAt: string;
  available: boolean;
}

export interface AvailabilityOptions {
  tenantId: string;
  staffId: string;
  serviceId: string;
  date: string;
  timezone: string;
  slotIntervalMinutes?: number;
}

export interface StaffAvailabilitySummaryRow {
  staffId: string;
  staffName: string;
  nextAvailableSlot: string | null;
  slotsToday: number;
}

interface TimedRange {
  startAt: Date;
  endAt: Date;
}

function parseTimeOnDate(date: string, time: string, timezone: string): Date {
  const local = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  return fromZonedTime(local, timezone);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return areIntervalsOverlapping(
    { start: aStart, end: aEnd },
    { start: bStart, end: bEnd },
    { inclusive: false }
  );
}

function groupByStaffId<T extends { staffId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const current = map.get(item.staffId) ?? [];
    current.push(item);
    map.set(item.staffId, current);
  }
  return map;
}

function dedupeSchedules<T extends { startTime: string; endTime: string }>(schedules: T[]): T[] {
  const seen = new Set<string>();
  return schedules.filter((schedule) => {
    const key = `${schedule.startTime}-${schedule.endTime}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeSlots(slots: TimeSlot[]): TimeSlot[] {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    if (seen.has(slot.startAt)) {
      return false;
    }
    seen.add(slot.startAt);
    return true;
  });
}

function computeSlots(input: {
  date: string;
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  daySchedules: Array<{ startTime: string; endTime: string }>;
  exceptions: Array<{
    staffId: string | null;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
  }>;
  staffId: string;
  blockedRanges: TimedRange[];
  now?: Date;
}): TimeSlot[] {
  const now = input.now ?? new Date();
  const tenantClosed = input.exceptions.some((e) => !e.staffId && e.isClosed);
  if (tenantClosed) {
    return [];
  }

  const staffException = input.exceptions.find((e) => e.staffId === input.staffId);
  if (staffException?.isClosed) {
    return [];
  }

  const windows: Array<{ start: Date; end: Date }> = [];

  if (staffException?.startTime && staffException.endTime) {
    windows.push({
      start: parseTimeOnDate(input.date, staffException.startTime, input.timezone),
      end: parseTimeOnDate(input.date, staffException.endTime, input.timezone),
    });
  } else {
    for (const schedule of dedupeSchedules(input.daySchedules)) {
      windows.push({
        start: parseTimeOnDate(input.date, schedule.startTime, input.timezone),
        end: parseTimeOnDate(input.date, schedule.endTime, input.timezone),
      });
    }
  }

  if (windows.length === 0) {
    return [];
  }

  const slots: TimeSlot[] = [];

  for (const window of windows) {
    let cursor = window.start;
    while (
      isBefore(addMinutes(cursor, input.durationMinutes), window.end) ||
      addMinutes(cursor, input.durationMinutes).getTime() === window.end.getTime()
    ) {
      const slotEnd = addMinutes(cursor, input.durationMinutes);

      if (isBefore(slotEnd, now)) {
        cursor = addMinutes(cursor, input.slotIntervalMinutes);
        continue;
      }

      const blocked = input.blockedRanges.some((item) =>
        overlaps(cursor, slotEnd, item.startAt, item.endAt)
      );

      slots.push({
        startAt: cursor.toISOString(),
        endAt: slotEnd.toISOString(),
        available: !blocked,
      });

      cursor = addMinutes(cursor, input.slotIntervalMinutes);
    }
  }

  return dedupeSlots(slots);
}

async function loadDayContext(
  tenantId: string,
  staffIds: string[],
  date: string,
  timezone: string
) {
  const dayStart = fromZonedTime(`${date}T00:00:00`, timezone);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const dayOfWeek = toZonedTime(parseISO(`${date}T12:00:00`), timezone).getDay();
  const now = new Date();

  const [settings, daySchedules, exceptions, existingAppointments, existingHolds] =
    await Promise.all([
      db.query.tenantSettings.findFirst({
        where: eq(tenantSettings.tenantId, tenantId),
        columns: { slotIntervalMinutes: true },
      }),
      staffIds.length > 0
        ? db.query.schedules.findMany({
            where: and(
              eq(schedules.tenantId, tenantId),
              inArray(schedules.staffId, staffIds),
              eq(schedules.dayOfWeek, dayOfWeek),
              eq(schedules.isActive, true)
            ),
            columns: { staffId: true, startTime: true, endTime: true },
          })
        : Promise.resolve([]),
      db.query.scheduleExceptions.findMany({
        where: and(
          eq(scheduleExceptions.tenantId, tenantId),
          eq(scheduleExceptions.date, date),
          or(
            staffIds.length > 0 ? inArray(scheduleExceptions.staffId, staffIds) : sql`false`,
            sql`${scheduleExceptions.staffId} IS NULL`
          )
        ),
        columns: {
          staffId: true,
          isClosed: true,
          startTime: true,
          endTime: true,
        },
      }),
      staffIds.length > 0
        ? db.query.appointments.findMany({
            where: and(
              eq(appointments.tenantId, tenantId),
              inArray(appointments.staffId, staffIds),
              gte(appointments.startAt, dayStart),
              lt(appointments.startAt, dayEnd),
              inArray(appointments.status, ["pending", "confirmed"])
            ),
            columns: { staffId: true, startAt: true, endAt: true },
          })
        : Promise.resolve([]),
      staffIds.length > 0
        ? db.query.appointmentHolds.findMany({
            where: and(
              eq(appointmentHolds.tenantId, tenantId),
              inArray(appointmentHolds.staffId, staffIds),
              gte(appointmentHolds.startAt, dayStart),
              lt(appointmentHolds.startAt, dayEnd),
              gte(appointmentHolds.expiresAt, now)
            ),
            columns: { staffId: true, startAt: true, endAt: true },
          })
        : Promise.resolve([]),
    ]);

  return {
    settings,
    schedulesByStaff: groupByStaffId(daySchedules),
    exceptions,
    appointmentsByStaff: groupByStaffId(existingAppointments),
    holdsByStaff: groupByStaffId(existingHolds),
    now,
  };
}

export async function getAvailableSlots(
  options: AvailabilityOptions
): Promise<TimeSlot[]> {
  const cacheKey = buildAvailabilityCacheKey(
    options.tenantId,
    options.staffId,
    options.date,
    options.serviceId
  );
  const cached = await getCachedAvailability<TimeSlot[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const [service, dayContext] = await Promise.all([
    db.query.services.findFirst({
      where: and(eq(services.id, options.serviceId), eq(services.tenantId, options.tenantId)),
      columns: { id: true, durationMinutes: true },
    }),
    loadDayContext(options.tenantId, [options.staffId], options.date, options.timezone),
  ]);

  if (!service) {
    return [];
  }

  const interval =
    options.slotIntervalMinutes ?? dayContext.settings?.slotIntervalMinutes ?? 15;
  const blockedRanges = [
    ...(dayContext.appointmentsByStaff.get(options.staffId) ?? []),
    ...(dayContext.holdsByStaff.get(options.staffId) ?? []),
  ];

  const slots = computeSlots({
    date: options.date,
    timezone: options.timezone,
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: interval,
    daySchedules: dayContext.schedulesByStaff.get(options.staffId) ?? [],
    exceptions: dayContext.exceptions,
    staffId: options.staffId,
    blockedRanges,
    now: dayContext.now,
  });

  await setCachedAvailability(cacheKey, slots, 120);
  return slots;
}

export async function getStaffAvailabilitySummary(
  tenantId: string,
  timezone: string,
  date: string
): Promise<StaffAvailabilitySummaryRow[]> {
  const summaryCacheKey = buildAvailabilitySummaryCacheKey(tenantId, date);
  const cached = await getCachedAvailability<StaffAvailabilitySummaryRow[]>(summaryCacheKey);
  if (cached) {
    return cached;
  }

  const [staffMembers, defaultService] = await Promise.all([
    db.query.staff.findMany({
      where: and(eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
      columns: { id: true, name: true, sortOrder: true },
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.name)],
    }),
    db.query.services.findFirst({
      where: and(eq(services.tenantId, tenantId), eq(services.isActive, true)),
      columns: { id: true, durationMinutes: true },
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.name)],
    }),
  ]);

  if (!defaultService) {
    const empty = staffMembers.map((member) => ({
      staffId: member.id,
      staffName: member.name,
      nextAvailableSlot: null,
      slotsToday: 0,
    }));
    await setCachedAvailability(summaryCacheKey, empty, 60);
    return empty;
  }

  const staffIds = staffMembers.map((member) => member.id);
  const dayContext = await loadDayContext(tenantId, staffIds, date, timezone);
  const interval = dayContext.settings?.slotIntervalMinutes ?? 15;

  const perStaff = staffMembers.map((member) => {
    const blockedRanges = [
      ...(dayContext.appointmentsByStaff.get(member.id) ?? []),
      ...(dayContext.holdsByStaff.get(member.id) ?? []),
    ];

    const slots = computeSlots({
      date,
      timezone,
      durationMinutes: defaultService.durationMinutes,
      slotIntervalMinutes: interval,
      daySchedules: dayContext.schedulesByStaff.get(member.id) ?? [],
      exceptions: dayContext.exceptions,
      staffId: member.id,
      blockedRanges,
      now: dayContext.now,
    });

    const available = slots.filter((slot) => slot.available);
    return {
      member,
      slots,
      summary: {
        staffId: member.id,
        staffName: member.name,
        nextAvailableSlot: available[0]?.startAt ?? null,
        slotsToday: available.length,
      },
    };
  });

  const summary = perStaff.map((row) => row.summary);

  await Promise.all([
    setCachedAvailability(summaryCacheKey, summary, 60),
    ...perStaff.map((row) =>
      setCachedAvailability(
        buildAvailabilityCacheKey(tenantId, row.member.id, date, defaultService.id),
        row.slots,
        120
      )
    ),
  ]);

  return summary;
}

export async function clearAvailabilityCacheForSlot(
  tenantId: string,
  staffId: string,
  serviceId: string,
  startAt: Date,
  timezone: string
): Promise<void> {
  const zoned = toZonedTime(startAt, timezone);
  const dateKey = format(startOfDay(zoned), "yyyy-MM-dd");
  await invalidateAvailabilityCache(tenantId, staffId, dateKey, serviceId);
}

export { overlaps };
