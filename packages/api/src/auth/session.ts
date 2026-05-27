import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, memberships, tenants } from "@sistema-turnos/db";
import type { AuthSession, MembershipRole } from "./types";

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthSession | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user?.passwordHash) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  const userMemberships = await db
    .select({
      tenantId: memberships.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .where(eq(memberships.userId, user.id));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    memberships: userMemberships.map((m) => ({
      tenantId: m.tenantId,
      tenantSlug: m.tenantSlug,
      tenantName: m.tenantName,
      role: m.role as MembershipRole,
    })),
  };
}

export async function getSessionForUserId(userId: string): Promise<AuthSession | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const userMemberships = await db
    .select({
      tenantId: memberships.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .where(eq(memberships.userId, user.id));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
    },
    memberships: userMemberships.map((m) => ({
      tenantId: m.tenantId,
      tenantSlug: m.tenantSlug,
      tenantName: m.tenantName,
      role: m.role as MembershipRole,
    })),
  };
}

export function getMembershipForTenant(
  session: AuthSession,
  tenantSlug: string
): AuthSession["memberships"][number] | undefined {
  return session.memberships.find((m) => m.tenantSlug === tenantSlug);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
