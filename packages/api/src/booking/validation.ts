import { and, eq, inArray } from "drizzle-orm";
import { db, services, staff, staffServices } from "@sistema-turnos/db";
import { getStaffServiceOffering } from "../catalog/staff-offering";

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export async function assertStaffServiceForTenant(
  tenantId: string,
  staffId: string,
  serviceId: string
) {
  const offering = await getStaffServiceOffering(tenantId, staffId, serviceId);

  if (!offering) {
    const staffMember = await db.query.staff.findFirst({
      where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
      columns: { id: true },
    });

    if (!staffMember) {
      throw new BookingValidationError("Profesional no válido para este local.");
    }

    const service = await db.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.tenantId, tenantId),
        eq(services.isActive, true)
      ),
      columns: { id: true },
    });

    if (!service) {
      throw new BookingValidationError("Servicio no válido para este local.");
    }

    throw new BookingValidationError("Este profesional no realiza ese servicio.");
  }

  return {
    serviceId: offering.serviceId,
    durationMinutes: offering.durationMinutes,
    priceCents: offering.priceCents,
  };
}

export async function assertServiceIdsForTenant(tenantId: string, serviceIds: string[]) {
  if (serviceIds.length === 0) {
    return;
  }

  const valid = await db.query.services.findMany({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.isActive, true),
      inArray(services.id, serviceIds)
    ),
    columns: { id: true },
  });

  if (valid.length !== serviceIds.length) {
    throw new BookingValidationError("Uno o más servicios no son válidos para este local.");
  }
}
