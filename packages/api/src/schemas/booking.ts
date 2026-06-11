import { z } from "zod";

export const holdBodySchema = z.object({
  action: z.enum(["hold"]).optional(),
  staffId: z.string().uuid("Profesional inválido."),
  serviceId: z.string().uuid("Servicio inválido."),
  startAt: z.string().min(1, "Horario obligatorio."),
  sessionId: z.string().min(1).optional(),
});

export const confirmBodySchema = z.object({
  action: z.literal("confirm"),
  holdId: z.string().uuid("Reserva temporal inválida."),
  clientName: z.string().trim().min(1, "Nombre obligatorio.").max(200),
  clientEmail: z.union([z.string().email(), z.literal("")]).optional(),
  clientPhone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const offeringUpdateSchema = z.object({
  serviceId: z.string().uuid(),
  durationMinutes: z.number().int().min(5).max(480).nullable().optional(),
  pricePesos: z.number().min(0).nullable().optional(),
});

export const offeringsPatchSchema = z.object({
  offerings: z.array(offeringUpdateSchema).min(1),
});

export const scheduleWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{1,2}:\d{2}/, "Hora de inicio inválida."),
  endTime: z.string().regex(/^\d{1,2}:\d{2}/, "Hora de fin inválida."),
});

export const schedulesPatchSchema = z.object({
  windows: z.array(scheduleWindowSchema),
});

export const scheduleExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
    isClosed: z.boolean(),
    startTime: z.string().regex(/^\d{1,2}:\d{2}/).nullable().optional(),
    endTime: z.string().regex(/^\d{1,2}:\d{2}/).nullable().optional(),
    reason: z.string().max(200).nullable().optional(),
  })
  .refine(
    (value) => value.isClosed || (Boolean(value.startTime) && Boolean(value.endTime)),
    { message: "Horario especial requiere inicio y fin." }
  );

export const scheduleExceptionsPatchSchema = z.object({
  exceptions: z.array(scheduleExceptionSchema),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(1, "Contraseña obligatoria.").max(200),
});

export const publicCancelSchema = z.object({
  action: z.literal("cancel"),
});

export const staffProfilePatchSchema = z.object({
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
  instagramUrl: z.string().max(200).nullable().optional(),
  tiktokUrl: z.string().max(200).nullable().optional(),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().max(50).optional(),
});

export const staffPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().max(50).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  pricePesos: z.number().min(0).nullable().optional(),
});

export const servicePatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  pricePesos: z.number().min(0).nullable().optional(),
});

export const walkInSchema = z.object({
  staffId: z.string().uuid("Profesional inválido."),
  serviceId: z.string().uuid("Servicio inválido."),
  startAt: z.string().min(1, "Horario obligatorio."),
  clientName: z.string().trim().min(1, "Nombre obligatorio.").max(200),
  clientEmail: z.union([z.string().email(), z.literal("")]).optional(),
  clientPhone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string().uuid("Turno inválido."),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
});
