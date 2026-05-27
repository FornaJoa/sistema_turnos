import "./load-env.ts";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  tenants,
  tenantSettings,
  users,
  memberships,
  staff,
  services,
  staffServices,
  schedules,
} from "./schema/index";

async function seed() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const [ownerUser] = await db
    .insert(users)
    .values({
      email: "owner@demo.com",
      name: "Dueño Demo",
      passwordHash,
      isPlatformAdmin: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const owner =
    ownerUser ??
    (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, "owner@demo.com") }))!;

  const [tenant] = await db
    .insert(tenants)
    .values({
      slug: "barberia-demo",
      name: "Barbería Demo",
      timezone: "America/Argentina/Buenos_Aires",
    })
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  const existingTenant =
    tenant ??
    (await db.query.tenants.findFirst({
      where: (t, { eq }) => eq(t.slug, "barberia-demo"),
    }))!;

  await db
    .insert(tenantSettings)
    .values({ tenantId: existingTenant.id })
    .onConflictDoNothing({ target: tenantSettings.tenantId });

  await db
    .insert(memberships)
    .values({
      tenantId: existingTenant.id,
      userId: owner.id,
      role: "owner",
    })
    .onConflictDoNothing();

  const [adminUser] = await db
    .insert(users)
    .values({
      email: "admin@demo.com",
      name: "Admin Demo",
      passwordHash,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const admin =
    adminUser ??
    (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, "admin@demo.com") }))!;

  await db
    .insert(memberships)
    .values({
      tenantId: existingTenant.id,
      userId: admin.id,
      role: "admin",
    })
    .onConflictDoNothing();

  const [receptionUser] = await db
    .insert(users)
    .values({
      email: "reception@demo.com",
      name: "Recepción Demo",
      passwordHash,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const reception =
    receptionUser ??
    (await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, "reception@demo.com"),
    }))!;

  await db
    .insert(memberships)
    .values({
      tenantId: existingTenant.id,
      userId: reception.id,
      role: "reception",
    })
    .onConflictDoNothing();

  const serviceData = [
    { name: "Corte clásico", durationMinutes: 30, priceCents: 150000, sortOrder: 0 },
    { name: "Corte + barba", durationMinutes: 45, priceCents: 220000, sortOrder: 1 },
    { name: "Barba", durationMinutes: 20, priceCents: 90000, sortOrder: 2 },
  ];

  const createdServices = [];
  for (const svc of serviceData) {
    const existing = await db.query.services.findFirst({
      where: (s, { and, eq }) =>
        and(eq(s.tenantId, existingTenant.id), eq(s.name, svc.name)),
    });
    if (existing) {
      createdServices.push(existing);
      continue;
    }
    const [created] = await db
      .insert(services)
      .values({ tenantId: existingTenant.id, ...svc })
      .returning();
    createdServices.push(created);
  }

  const staffData = [
    { name: "Juan Pérez", email: "juan@demo.com", phone: "+5491112345678", sortOrder: 0 },
    { name: "María López", email: "maria@demo.com", phone: "+5491187654321", sortOrder: 1 },
  ];

  const createdStaff = [];
  for (const member of staffData) {
    const existing = await db.query.staff.findFirst({
      where: (s, { and, eq }) =>
        and(eq(s.tenantId, existingTenant.id), eq(s.name, member.name)),
    });
    if (existing) {
      createdStaff.push(existing);
      continue;
    }
    const [created] = await db
      .insert(staff)
      .values({ tenantId: existingTenant.id, ...member })
      .returning();
    createdStaff.push(created);
  }

  for (const staffMember of createdStaff) {
    for (const service of createdServices) {
      await db
        .insert(staffServices)
        .values({ staffId: staffMember.id, serviceId: service.id })
        .onConflictDoNothing();
    }

    for (let day = 1; day <= 5; day++) {
      await db
        .insert(schedules)
        .values({
          tenantId: existingTenant.id,
          staffId: staffMember.id,
          dayOfWeek: day,
          startTime: "09:00:00",
          endTime: "18:00:00",
        })
        .onConflictDoNothing({
          target: [schedules.staffId, schedules.dayOfWeek, schedules.startTime, schedules.endTime],
        });
    }
  }

  const barberAccounts = [
    { email: "juan@demo.com", name: "Juan Pérez", staffName: "Juan Pérez" },
    { email: "maria@demo.com", name: "María López", staffName: "María López" },
  ];

  for (const account of barberAccounts) {
    const [barberUser] = await db
      .insert(users)
      .values({ email: account.email, name: account.name, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning();

    const user =
      barberUser ??
      (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, account.email) }))!;

    await db
      .insert(memberships)
      .values({ tenantId: existingTenant.id, userId: user.id, role: "staff" })
      .onConflictDoNothing();

    const staffRecord = createdStaff.find((s) => s.name === account.staffName);
    if (staffRecord) {
      await db
        .update(staff)
        .set({ userId: user.id, email: account.email })
        .where(eq(staff.id, staffRecord.id));
    }
  }

  console.log("Seed completed.");
  console.log("Tenant slug: barberia-demo");
  console.log("Users: owner@demo.com / admin@demo.com / reception@demo.com");
  console.log("Barberos: juan@demo.com / maria@demo.com");
  console.log("Password: password123");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
