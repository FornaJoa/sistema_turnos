import { eq } from "drizzle-orm";
import { db, tenants } from "@sistema-turnos/db";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";

async function fetchTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    with: { settings: true },
  });
}

export async function getTenantBySlug(slug: string) {
  const tenant = await unstable_cache(
    () => fetchTenantBySlug(slug),
    [`tenant-${slug}`],
    { revalidate: 120, tags: [`tenant-${slug}`] }
  )();

  if (!tenant) {
    notFound();
  }

  return tenant;
}

export async function getTenantBySlugFresh(slug: string) {
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }
  return tenant;
}

export async function findTenantBySlug(slug: string) {
  return fetchTenantBySlug(slug);
}
