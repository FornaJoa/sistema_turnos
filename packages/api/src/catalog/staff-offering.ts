import { and, eq, inArray } from "drizzle-orm";
import { db, services, staff, staffServices } from "@sistema-turnos/db";

export interface StaffServiceOffering {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number | null;
  defaultDurationMinutes: number;
  defaultPriceCents: number | null;
  isCustomDuration: boolean;
  isCustomPrice: boolean;
}

export interface ResolvedStaffServiceTerms {
  serviceId: string;
  durationMinutes: number;
  priceCents: number | null;
}

export function resolveStaffServiceTerms(
  service: { id: string; durationMinutes: number; priceCents: number | null },
  link: { durationMinutes: number | null; priceCents: number | null }
): ResolvedStaffServiceTerms {
  return {
    serviceId: service.id,
    durationMinutes: link.durationMinutes ?? service.durationMinutes,
    priceCents: link.priceCents ?? service.priceCents,
  };
}

export async function getStaffServiceOffering(
  tenantId: string,
  staffId: string,
  serviceId: string
): Promise<StaffServiceOffering | null> {
  const [staffMember, service, link] = await Promise.all([
    db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
      columns: { id: true },
    }),
    db.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.tenantId, tenantId),
        eq(services.isActive, true)
      ),
    }),
    db.query.staffServices.findFirst({
      where: and(eq(staffServices.staffId, staffId), eq(staffServices.serviceId, serviceId)),
    }),
  ]);

  if (!staffMember || !service || !link) {
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
}

export async function listStaffServiceOfferings(
  tenantId: string,
  staffId: string
): Promise<StaffServiceOffering[]> {
  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
    columns: { id: true },
  });

  if (!staffMember) {
    return [];
  }

  const links = await db.query.staffServices.findMany({
    where: eq(staffServices.staffId, staffId),
  });

  if (links.length === 0) {
    return [];
  }

  const serviceList = await db.query.services.findMany({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.isActive, true),
      inArray(
        services.id,
        links.map((link) => link.serviceId)
      )
    ),
    orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.name)],
  });

  const linkByService = new Map(links.map((link) => [link.serviceId, link]));

  return serviceList.map((service) => {
    const link = linkByService.get(service.id)!;
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
  });
}

export interface StaffOfferingUpdate {
  serviceId: string;
  durationMinutes?: number | null;
  pricePesos?: number | null;
}

export async function updateStaffServiceOfferings(
  tenantId: string,
  staffId: string,
  updates: StaffOfferingUpdate[]
) {
  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
    columns: { id: true },
  });

  if (!staffMember) {
    throw new Error("Staff not found");
  }

  for (const update of updates) {
    const service = await db.query.services.findFirst({
      where: and(
        eq(services.id, update.serviceId),
        eq(services.tenantId, tenantId),
        eq(services.isActive, true)
      ),
      columns: { id: true },
    });

    if (!service) {
      throw new Error(`Invalid service ${update.serviceId}`);
    }

    const link = await db.query.staffServices.findFirst({
      where: and(
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, update.serviceId)
      ),
      columns: { id: true },
    });

    if (!link) {
      throw new Error(`Staff does not offer service ${update.serviceId}`);
    }

    const patch: { durationMinutes?: number | null; priceCents?: number | null } = {};

    if ("durationMinutes" in update) {
      const value = update.durationMinutes;
      patch.durationMinutes =
        value == null ? null : Math.max(5, Math.round(Number(value)));
    }

    if ("pricePesos" in update) {
      const value = update.pricePesos;
      patch.priceCents =
        value == null ? null : Math.max(0, Math.round(Number(value) * 100));
    }

    if (Object.keys(patch).length > 0) {
      await db
        .update(staffServices)
        .set(patch)
        .where(
          and(eq(staffServices.staffId, staffId), eq(staffServices.serviceId, update.serviceId))
        );
    }
  }

  return listStaffServiceOfferings(tenantId, staffId);
}
