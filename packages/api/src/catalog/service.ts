import { and, eq, inArray } from "drizzle-orm";
import { db, services, staff, staffServices } from "@sistema-turnos/db";

export async function getTenantCatalog(tenantId: string) {
  const [serviceList, staffList] = await Promise.all([
    db.query.services.findMany({
      where: and(eq(services.tenantId, tenantId), eq(services.isActive, true)),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.name)],
    }),
    db.query.staff.findMany({
      where: and(eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.name)],
    }),
  ]);

  const activeServiceIds = new Set(serviceList.map((service) => service.id));
  const staffIds = staffList.map((member) => member.id);
  const allLinks =
    staffIds.length > 0
      ? await db.query.staffServices.findMany({
          where: inArray(staffServices.staffId, staffIds),
        })
      : [];

  const linksByStaff = new Map<string, string[]>();
  for (const link of allLinks) {
    if (!activeServiceIds.has(link.serviceId)) {
      continue;
    }
    const current = linksByStaff.get(link.staffId) ?? [];
    current.push(link.serviceId);
    linksByStaff.set(link.staffId, current);
  }

  return {
    services: serviceList,
    staff: staffList.map((member) => ({
      ...member,
      serviceIds: linksByStaff.get(member.id) ?? [],
    })),
  };
}
