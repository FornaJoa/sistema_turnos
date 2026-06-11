import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, appointments, services, staff } from "@sistema-turnos/db";

export interface AnalyticsFilters {
  tenantId: string;
  from: Date;
  to: Date;
  timezone: string;
}

export async function getOwnerAnalytics(filters: AnalyticsFilters) {
  const { tenantId, from, to, timezone } = filters;

  const [statusCounts, byStaff, byService, peakHours, clients] = await Promise.all([
    db
      .select({
        status: appointments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, from),
          lte(appointments.startAt, to)
        )
      )
      .groupBy(appointments.status),

    db
      .select({
        staffId: appointments.staffId,
        staffName: staff.name,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
      })
      .from(appointments)
      .innerJoin(staff, eq(appointments.staffId, staff.id))
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, from),
          lte(appointments.startAt, to)
        )
      )
      .groupBy(appointments.staffId, staff.name),

    db
      .select({
        serviceId: appointments.serviceId,
        serviceName: services.name,
        total: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, from),
          lte(appointments.startAt, to)
        )
      )
      .groupBy(appointments.serviceId, services.name)
      .orderBy(sql`count(*) desc`),

    db
      .select({
        hour: sql<number>`extract(hour from timezone(${timezone}, ${appointments.startAt}))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, from),
          lte(appointments.startAt, to)
        )
      )
      .groupBy(sql`extract(hour from timezone(${timezone}, ${appointments.startAt}))`)
      .orderBy(sql`count(*) desc`),

    db
      .select({
        clientEmail: appointments.clientEmail,
        clientPhone: appointments.clientPhone,
        clientName: appointments.clientName,
        visits: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startAt, from),
          lte(appointments.startAt, to)
        )
      )
      .groupBy(appointments.clientEmail, appointments.clientPhone, appointments.clientName),
  ]);

  const totalAppointments = statusCounts.reduce((acc, row) => acc + row.count, 0);
  const recurringClients = clients.filter((c) => c.visits > 1).length;
  const newClients = clients.filter((c) => c.visits === 1).length;

  return {
    totalAppointments,
    statusCounts,
    byStaff,
    byService,
    peakHours,
    recurringClients,
    newClients,
  };
}

export function analyticsToCsv(data: Awaited<ReturnType<typeof getOwnerAnalytics>>): string {
  const lines = ["metric,value"];
  lines.push(`total_appointments,${data.totalAppointments}`);
  lines.push(`new_clients,${data.newClients}`);
  lines.push(`recurring_clients,${data.recurringClients}`);

  for (const row of data.statusCounts) {
    lines.push(`status_${row.status},${row.count}`);
  }

  for (const row of data.byStaff) {
    lines.push(`staff_${row.staffName}_total,${row.total}`);
    lines.push(`staff_${row.staffName}_completed,${row.completed}`);
  }

  return lines.join("\n");
}
