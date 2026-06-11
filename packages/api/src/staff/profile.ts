import { and, eq } from "drizzle-orm";
import { db, staff } from "@sistema-turnos/db";

export type StaffPublicProfileInput = {
  bio?: string | null;
  avatarUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
};

export type StaffCatalogProfile = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  sortOrder: number;
};

export function mapStaffCatalogProfile<
  TOffering extends { serviceId: string },
>(
  member: {
    id: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    sortOrder: number;
    email?: string | null;
    phone?: string | null;
  },
  extras: { serviceIds: string[]; offerings: TOffering[] },
  includePrivate = false
) {
  const profile = {
    id: member.id,
    name: member.name,
    bio: member.bio,
    avatarUrl: member.avatarUrl,
    instagramUrl: member.instagramUrl,
    tiktokUrl: member.tiktokUrl,
    sortOrder: member.sortOrder,
    serviceIds: extras.serviceIds,
    offerings: extras.offerings,
    ...(includePrivate
      ? { email: member.email ?? null, phone: member.phone ?? null }
      : {}),
  };

  return profile;
}

export async function getStaffPublicProfile(tenantId: string, staffId: string) {
  return db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), eq(staff.isActive, true)),
    columns: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      instagramUrl: true,
      tiktokUrl: true,
    },
  });
}

export async function updateStaffPublicProfile(
  tenantId: string,
  staffId: string,
  input: StaffPublicProfileInput
) {
  const member = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)),
    columns: { id: true },
  });

  if (!member) {
    throw new Error("Staff not found");
  }

  const [updated] = await db
    .update(staff)
    .set({
      bio: input.bio?.trim() || null,
      avatarUrl: input.avatarUrl?.trim() || null,
      instagramUrl: normalizeSocialUrl(input.instagramUrl, "instagram"),
      tiktokUrl: normalizeSocialUrl(input.tiktokUrl, "tiktok"),
      updatedAt: new Date(),
    })
    .where(eq(staff.id, staffId))
    .returning();

  return {
    id: updated.id,
    name: updated.name,
    bio: updated.bio,
    avatarUrl: updated.avatarUrl,
    instagramUrl: updated.instagramUrl,
    tiktokUrl: updated.tiktokUrl,
  };
}

function normalizeSocialUrl(value: string | null | undefined, platform: "instagram" | "tiktok") {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const handle = trimmed.replace(/^@/, "");
  if (platform === "instagram") {
    return `https://instagram.com/${handle}`;
  }
  return `https://tiktok.com/@${handle}`;
}
