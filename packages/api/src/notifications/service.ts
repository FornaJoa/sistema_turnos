import { Resend } from "resend";
import { and, eq } from "drizzle-orm";
import { db, notifications, appointments, tenants } from "@sistema-turnos/db";
import { sendWhatsAppNotification } from "./whatsapp";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type NotificationEvent =
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_updated"
  | "appointment_reminder";

function formatDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

function buildEmailContent(
  event: NotificationEvent,
  data: {
    clientName: string;
    serviceName: string;
    staffName: string;
    startAt: Date;
    timezone: string;
    tenantName: string;
    publicUrl: string;
  }
) {
  const when = formatDate(data.startAt, data.timezone);
  const subjects: Record<NotificationEvent, string> = {
    appointment_created: `Turno recibido - ${data.tenantName}`,
    appointment_confirmed: `Turno confirmado - ${data.tenantName}`,
    appointment_cancelled: `Turno cancelado - ${data.tenantName}`,
    appointment_updated: `Actualización de turno - ${data.tenantName}`,
    appointment_reminder: `Recordatorio de turno - ${data.tenantName}`,
  };

  const body = `
    <h2>${subjects[event]}</h2>
    <p>Hola ${data.clientName},</p>
    <p><strong>Servicio:</strong> ${data.serviceName}</p>
    <p><strong>Profesional:</strong> ${data.staffName}</p>
    <p><strong>Fecha y hora:</strong> ${when}</p>
    <p><a href="${data.publicUrl}">Ver o cancelar turno</a></p>
  `;

  return { subject: subjects[event], body };
}

async function logNotification(input: {
  tenantId: string;
  appointmentId: string;
  channel: "email" | "whatsapp";
  template: string;
  recipient: string;
  status: "pending" | "sent" | "failed";
  payload?: Record<string, unknown>;
  errorMessage?: string;
}) {
  await db.insert(notifications).values({
    tenantId: input.tenantId,
    appointmentId: input.appointmentId,
    channel: input.channel,
    template: input.template,
    recipient: input.recipient,
    status: input.status,
    payload: input.payload,
    errorMessage: input.errorMessage,
    sentAt: input.status === "sent" ? new Date() : null,
  });
}

type AppointmentWithRelations = {
  id: string;
  tenantId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  startAt: Date;
  publicToken: string;
  staff: { name: string; email: string | null; phone: string | null };
  service: { name: string };
  tenant: {
    slug: string;
    name: string;
    timezone: string;
    settings: { whatsappEnabled: boolean } | null;
  };
};

async function dispatchAppointmentNotifications(
  appointment: AppointmentWithRelations,
  event: NotificationEvent
) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const publicUrl = `${baseUrl}/${appointment.tenant.slug}/turno/${appointment.publicToken}`;
  const timezone = appointment.tenant.timezone;

  const emailPayload = {
    clientName: appointment.clientName,
    serviceName: appointment.service.name,
    staffName: appointment.staff.name,
    startAt: appointment.startAt,
    timezone,
    tenantName: appointment.tenant.name,
    publicUrl,
  };

  if (appointment.clientEmail) {
    const { subject, body } = buildEmailContent(event, emailPayload);
    try {
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "turnos@example.com",
          to: appointment.clientEmail,
          subject,
          html: body,
        });
        await logNotification({
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
          channel: "email",
          template: event,
          recipient: appointment.clientEmail,
          status: "sent",
          payload: emailPayload,
        });
      } else {
        console.log("[email:dev]", subject, appointment.clientEmail);
        await logNotification({
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
          channel: "email",
          template: event,
          recipient: appointment.clientEmail,
          status: "sent",
          payload: { ...emailPayload, mode: "dev-log" },
        });
      }
    } catch (error) {
      await logNotification({
        tenantId: appointment.tenantId,
        appointmentId: appointment.id,
        channel: "email",
        template: event,
        recipient: appointment.clientEmail,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (appointment.staff.email) {
    const staffSubject = `Nuevo turno - ${appointment.clientName}`;
    const staffBody = `
      <p>Tenés un turno ${event === "appointment_cancelled" ? "cancelado" : "programado"}.</p>
      <p><strong>Cliente:</strong> ${appointment.clientName}</p>
      <p><strong>Servicio:</strong> ${appointment.service.name}</p>
      <p><strong>Fecha:</strong> ${formatDate(appointment.startAt, timezone)}</p>
    `;

    try {
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "turnos@example.com",
          to: appointment.staff.email,
          subject: staffSubject,
          html: staffBody,
        });
      } else {
        console.log("[email:dev:staff]", staffSubject, appointment.staff.email);
      }
    } catch (error) {
      console.error("Staff notification failed", error);
    }
  }

  if (appointment.tenant.settings?.whatsappEnabled) {
    const phone = appointment.clientPhone ?? appointment.staff.phone;
    if (phone) {
      try {
        await sendWhatsAppNotification({
          to: phone,
          template: event,
          variables: {
            client_name: appointment.clientName,
            service_name: appointment.service.name,
            staff_name: appointment.staff.name,
            datetime: formatDate(appointment.startAt, timezone),
            public_url: publicUrl,
          },
        });
        await logNotification({
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
          channel: "whatsapp",
          template: event,
          recipient: phone,
          status: "sent",
        });
      } catch (error) {
        await logNotification({
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
          channel: "whatsapp",
          template: event,
          recipient: phone,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }
}

export async function sendAppointmentNotifications(
  appointmentId: string,
  event: NotificationEvent,
  _actorUserId?: string
) {
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: {
      staff: true,
      service: true,
      tenant: { with: { settings: true } },
    },
  });

  if (!appointment) {
    return;
  }

  await dispatchAppointmentNotifications(appointment, event);
}

async function wasReminderSent(appointmentId: string) {
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.appointmentId, appointmentId),
      eq(notifications.template, "appointment_reminder"),
      eq(notifications.status, "sent")
    ),
    columns: { id: true },
  });
  return Boolean(existing);
}

export async function sendReminderNotifications() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowStart = new Date(in24h.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(in24h.getTime() + 30 * 60 * 1000);

  const upcoming = await db.query.appointments.findMany({
    where: (a, { and, eq, gte, lte }) =>
      and(eq(a.status, "confirmed"), gte(a.startAt, windowStart), lte(a.startAt, windowEnd)),
    with: {
      staff: true,
      service: true,
      tenant: { with: { settings: true } },
    },
  });

  for (const appointment of upcoming) {
    if (await wasReminderSent(appointment.id)) {
      continue;
    }
    await dispatchAppointmentNotifications(appointment, "appointment_reminder");
  }
}

export async function getTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    with: { settings: true },
  });
}
