import { and, eq } from "drizzle-orm";
import { db, tenants } from "@sistema-turnos/db";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";

async function fetchTenantBySlug(slug: string, activeOnly = false) {
  return db.query.tenants.findFirst({
    where: activeOnly
      ? and(eq(tenants.slug, slug), eq(tenants.isActive, true))
      : eq(tenants.slug, slug),
    with: { settings: true },
  });
}

export async function getTenantBySlug(slug: string) {
  const tenant = await unstable_cache(
    () => fetchTenantBySlug(slug, true),
    [`tenant-${slug}`],
    { revalidate: 120, tags: [`tenant-${slug}`] }
  )();

  if (!tenant) {
    notFound();
  }

  return tenant;
}

export async function getTenantBySlugFresh(slug: string) {
  const tenant = await fetchTenantBySlug(slug, true);
  if (!tenant) {
    notFound();
  }
  return tenant;
}

export async function findTenantBySlug(slug: string) {
  return fetchTenantBySlug(slug, true);
}

export async function findTenantBySlugIncludingInactive(slug: string) {
  return fetchTenantBySlug(slug, false);
}
