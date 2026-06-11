import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  time,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "reception",
  "staff",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "whatsapp",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tenants_slug_idx").on(table.slug)]
);

export const tenantSettings = pgTable("tenant_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#4f46e5"),
  secondaryColor: text("secondary_color").notNull().default("#71717a"),
  accentColor: text("accent_color").notNull().default("#4f46e5"),
  fontFamily: text("font_family").notNull().default("inter"),
  welcomeTitle: text("welcome_title").notNull().default("Reservá tu turno online"),
  welcomeSubtitle: text("welcome_subtitle")
    .notNull()
    .default("Elegí servicio, profesional y el horario que más te convenga."),
  cancellationPolicy: text("cancellation_policy")
    .notNull()
    .default("Podés cancelar hasta 24 horas antes del turno."),
  holdMinutes: integer("hold_minutes").notNull().default(5),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(15),
  requireStaffConfirmation: boolean("require_staff_confirmation").notNull().default(false),
  receptionCanCreateStaff: boolean("reception_can_create_staff").notNull().default(false),
  cancellationHours: integer("cancellation_hours").notNull().default(24),
  whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_idx").on(table.tenantId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ]
);

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_tenant_idx").on(table.tenantId),
    index("staff_user_idx").on(table.userId),
  ]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("services_tenant_idx").on(table.tenantId)]
);

export const staffServices = pgTable(
  "staff_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    durationMinutes: integer("duration_minutes"),
    priceCents: integer("price_cents"),
  },
  (table) => [
    uniqueIndex("staff_services_unique_idx").on(table.staffId, table.serviceId),
  ]
);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("schedules_staff_day_idx").on(table.staffId, table.dayOfWeek),
    index("schedules_tenant_idx").on(table.tenantId),
    uniqueIndex("schedules_staff_day_window_idx").on(
      table.staffId,
      table.dayOfWeek,
      table.startTime,
      table.endTime
    ),
  ]
);

export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    startTime: time("start_time"),
    endTime: time("end_time"),
    reason: text("reason"),
  },
  (table) => [
    index("schedule_exceptions_staff_date_idx").on(table.staffId, table.date),
    index("schedule_exceptions_tenant_date_idx").on(table.tenantId, table.date),
  ]
);

export const appointmentHolds = pgTable(
  "appointment_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    sessionId: text("session_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("appointment_holds_staff_start_idx").on(table.staffId, table.startAt),
    index("appointment_holds_expires_idx").on(table.expiresAt),
    uniqueIndex("appointment_holds_staff_start_unique_idx").on(
      table.tenantId,
      table.staffId,
      table.startAt
    ),
  ]
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    notes: text("notes"),
    publicToken: text("public_token").notNull(),
    source: text("source").notNull().default("online"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("appointments_public_token_idx").on(table.publicToken),
    index("appointments_tenant_status_start_idx").on(
      table.tenantId,
      table.status,
      table.startAt
    ),
    index("appointments_tenant_start_idx").on(table.tenantId, table.startAt),
    index("appointments_staff_start_idx").on(table.staffId, table.startAt),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    channel: notificationChannelEnum("channel").notNull(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("notifications_appointment_idx").on(table.appointmentId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  settings: one(tenantSettings, {
    fields: [tenants.id],
    references: [tenantSettings.tenantId],
  }),
  memberships: many(memberships),
  staff: many(staff),
  services: many(services),
  appointments: many(appointments),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [staff.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [staff.userId],
    references: [users.id],
  }),
  schedules: many(schedules),
  staffServices: many(staffServices),
  appointments: many(appointments),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [services.tenantId],
    references: [tenants.id],
  }),
  staffServices: many(staffServices),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [appointments.tenantId],
    references: [tenants.id],
  }),
  staff: one(staff, {
    fields: [appointments.staffId],
    references: [staff.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  notifications: many(notifications),
}));
