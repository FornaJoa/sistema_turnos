import { and, eq, inArray } from "drizzle-orm";
import { db, services, staff, staffServices } from "@sistema-turnos/db";
import { listStaffServiceOfferings, resolveStaffServiceTerms } from "./staff-offering";

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

  const serviceById = new Map(serviceList.map((service) => [service.id, service]));
  const linksByStaff = new Map<string, typeof allLinks>();

  for (const link of allLinks) {
    if (!activeServiceIds.has(link.serviceId)) {
      continue;
    }
    const current = linksByStaff.get(link.staffId) ?? [];
    current.push(link);
    linksByStaff.set(link.staffId, current);
  }

  return {
    services: serviceList,
    staff: staffList.map((member) => {
      const links = linksByStaff.get(member.id) ?? [];
      const offerings = links
        .map((link) => {
          const service = serviceById.get(link.serviceId);
          if (!service) {
            return null;
          }
          const resolved = resolveStaffServiceTerms(service, link);
          return {
            serviceId: service.id,
            serviceName: service.name,
            durationMinutes: resolved.durationMinutes,
            priceCents: resolved.priceCents,
            defaultDurationMinutes: service.durationMinutes,
            defaultPriceCents: service.priceCents,
            isCustomDuration: link.durationMinutes != null,
            isCustomPrice: link.priceCents != null,
          };
        })
        .filter((offering): offering is NonNullable<typeof offering> => offering != null);

      return {
        ...member,
        serviceIds: offerings.map((offering) => offering!.serviceId),
        offerings,
      };
    }),
  };
}

export { listStaffServiceOfferings, updateStaffServiceOfferings } from "./staff-offering";
export type { StaffServiceOffering, StaffOfferingUpdate } from "./staff-offering";
