import { addMinutes } from "date-fns";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  appointmentHolds,
  appointments,
  services,
  tenantSettings,
  tenants,
} from "@sistema-turnos/db";
import { clearAvailabilityCacheForSlot, overlaps } from "../availability/engine";
import { sendAppointmentNotifications } from "../notifications/service";

export class BookingConflictError extends Error {
  constructor(message = "El horario ya no está disponible") {
    super(message);
    this.name = "BookingConflictError";
  }
}

export class HoldExpiredError extends Error {
  constructor(message = "La reserva temporal expiró") {
    super(message);
    this.name = "HoldExpiredError";
  }
}

interface CreateHoldInput {
  tenantSlug: string;
  staffId: string;
  serviceId: string;
  startAt: string;
  sessionId: string;
}

interface ConfirmAppointmentInput {
  holdId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  notes?: string;
  source?: string;
  createdByUserId?: string;
}

interface WalkInInput {
  tenantSlug: string;
  staffId: string;
  serviceId: string;
  startAt: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  notes?: string;
  createdByUserId?: string;
}

async function getTenantContext(tenantSlug: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug),
    with: { settings: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

async function assertSlotAvailable(
  client: Pick<typeof db, "query">,
  tenantId: string,
  staffId: string,
  startAt: Date,
  endAt: Date,
  excludeHoldId?: string
) {
  const [appointmentConflict, holdConflict] = await Promise.all([
    client.query.appointments.findFirst({
      where: and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.staffId, staffId),
        inArray(appointments.status, ["pending", "confirmed"]),
        lt(appointments.startAt, endAt),
        gt(appointments.endAt, startAt)
      ),
      columns: { id: true },
    }),
    client.query.appointmentHolds.findFirst({
      where: and(
        eq(appointmentHolds.tenantId, tenantId),
        eq(appointmentHolds.staffId, staffId),
        gt(appointmentHolds.expiresAt, new Date()),
        lt(appointmentHolds.startAt, endAt),
        gt(appointmentHolds.endAt, startAt),
        excludeHoldId ? ne(appointmentHolds.id, excludeHoldId) : undefined
      ),
      columns: { id: true },
    }),
  ]);

  if (appointmentConflict || holdConflict) {
    throw new BookingConflictError();
  }
}

export async function createHold(input: CreateHoldInput) {
  const tenant = await getTenantContext(input.tenantSlug);
  const settings = tenant.settings;
  const holdMinutes = settings?.holdMinutes ?? 5;

  const service = await db.query.services.findFirst({
    where: and(eq(services.id, input.serviceId), eq(services.tenantId, tenant.id)),
  });

  if (!service) {
    throw new Error("Service not found");
  }

  const startAt = new Date(input.startAt);
  const endAt = addMinutes(startAt, service.durationMinutes);

  return db.transaction(async (tx) => {
    await assertSlotAvailable(tx, tenant.id, input.staffId, startAt, endAt);

    const expiresAt = addMinutes(new Date(), holdMinutes);
    const [hold] = await tx
      .insert(appointmentHolds)
      .values({
        tenantId: tenant.id,
        staffId: input.staffId,
        serviceId: input.serviceId,
        startAt,
        endAt,
        sessionId: input.sessionId,
        expiresAt,
      })
      .returning();

    await clearAvailabilityCacheForSlot(
      tenant.id,
      input.staffId,
      input.serviceId,
      startAt,
      tenant.timezone
    );
    return { hold, expiresAt };
  });
}

export async function confirmAppointment(input: ConfirmAppointmentInput) {
  return db.transaction(async (tx) => {
    const hold = await tx.query.appointmentHolds.findFirst({
      where: eq(appointmentHolds.id, input.holdId),
    });

    if (!hold) {
      throw new HoldExpiredError("Hold not found");
    }

    if (hold.expiresAt <= new Date()) {
      await tx.delete(appointmentHolds).where(eq(appointmentHolds.id, hold.id));
      throw new HoldExpiredError();
    }

    await assertSlotAvailable(tx, hold.tenantId, hold.staffId, hold.startAt, hold.endAt, hold.id);

    const tenant = await tx.query.tenants.findFirst({
      where: eq(tenants.id, hold.tenantId),
      with: { settings: true },
    });

    const status = tenant?.settings?.requireStaffConfirmation ? "pending" : "confirmed";

    const [appointment] = await tx
      .insert(appointments)
      .values({
        tenantId: hold.tenantId,
        staffId: hold.staffId,
        serviceId: hold.serviceId,
        startAt: hold.startAt,
        endAt: hold.endAt,
        status,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        notes: input.notes,
        publicToken: nanoid(24),
        source: input.source ?? "online",
        createdByUserId: input.createdByUserId,
        confirmedAt: status === "confirmed" ? new Date() : null,
      })
      .returning();

    await tx.delete(appointmentHolds).where(eq(appointmentHolds.id, hold.id));

    if (tenant) {
      await clearAvailabilityCacheForSlot(
        tenant.id,
        hold.staffId,
        hold.serviceId,
        hold.startAt,
        tenant.timezone
      );
    }

    void sendAppointmentNotifications(appointment.id, "appointment_created");
    return appointment;
  });
}

export async function createWalkInAppointment(input: WalkInInput) {
  const tenant = await getTenantContext(input.tenantSlug);

  const service = await db.query.services.findFirst({
    where: and(eq(services.id, input.serviceId), eq(services.tenantId, tenant.id)),
  });

  if (!service) {
    throw new Error("Service not found");
  }

  const startAt = new Date(input.startAt);
  const endAt = addMinutes(startAt, service.durationMinutes);

  return db.transaction(async (tx) => {
    await assertSlotAvailable(tx, tenant.id, input.staffId, startAt, endAt);

    const [appointment] = await tx
      .insert(appointments)
      .values({
        tenantId: tenant.id,
        staffId: input.staffId,
        serviceId: input.serviceId,
        startAt,
        endAt,
        status: "confirmed",
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        notes: input.notes,
        publicToken: nanoid(24),
        source: "walk_in",
        createdByUserId: input.createdByUserId,
        confirmedAt: new Date(),
      })
      .returning();

    await clearAvailabilityCacheForSlot(
      tenant.id,
      input.staffId,
      input.serviceId,
      startAt,
      tenant.timezone
    );
    void sendAppointmentNotifications(appointment.id, "appointment_created");
    return appointment;
  });
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "confirmed" | "cancelled" | "completed" | "no_show",
  actorUserId?: string
) {
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
  });

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  const patch: Partial<typeof appointments.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "confirmed") {
    patch.confirmedAt = new Date();
  }
  if (status === "cancelled") {
    patch.cancelledAt = new Date();
  }
  if (status === "completed") {
    patch.completedAt = new Date();
  }

  const [updated] = await db
    .update(appointments)
    .set(patch)
    .where(eq(appointments.id, appointmentId))
    .returning();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, appointment.tenantId),
  });

  if (tenant) {
    await clearAvailabilityCacheForSlot(
      tenant.id,
      appointment.staffId,
      appointment.serviceId,
      appointment.startAt,
      tenant.timezone
    );
  }

  const event =
    status === "confirmed"
      ? "appointment_confirmed"
      : status === "cancelled"
        ? "appointment_cancelled"
        : "appointment_updated";

  void sendAppointmentNotifications(updated.id, event, actorUserId);
  return updated;
}

export async function getAppointmentByPublicToken(publicToken: string) {
  return db.query.appointments.findFirst({
    where: eq(appointments.publicToken, publicToken),
    with: {
      staff: true,
      service: true,
      tenant: { with: { settings: true } },
    },
  });
}

export async function cleanupExpiredHolds() {
  const now = new Date();
  await db.delete(appointmentHolds).where(lt(appointmentHolds.expiresAt, now));
}

export { overlaps };
