import { getTenantCatalog } from "@sistema-turnos/api";
import { and, eq } from "drizzle-orm";
import { db, tenants } from "@sistema-turnos/db";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

export type TenantCatalog = Awaited<ReturnType<typeof fetchTenantCatalog>>;

async function loadTenantWithCatalog(tenantSlug: string, includePrivate = false) {
  const tenant = await db.query.tenants.findFirst({
    where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
    with: { settings: true },
  });

  if (!tenant) {
    return null;
  }

  const catalog = await getTenantCatalog(tenant.id, includePrivate);

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      timezone: tenant.timezone,
      settings: tenant.settings,
    },
    services: catalog.services,
    staff: catalog.staff,
  };
}

export async function fetchTenantCatalog(tenantSlug: string) {
  const data = await loadTenantWithCatalog(tenantSlug);
  if (!data) {
    notFound();
  }
  return data;
}

/** Para route handlers: nunca devuelve HTML de notFound(). */
export async function getTenantCatalogForApi(
  tenantSlug: string,
  includePrivate = false
) {
  return loadTenantWithCatalog(tenantSlug, includePrivate);
}

export function getCachedTenantCatalog(tenantSlug: string) {
  return unstable_cache(
    () => fetchTenantCatalog(tenantSlug),
    [`tenant-catalog-${tenantSlug}`],
    { revalidate: 60, tags: [`tenant-${tenantSlug}`] }
  )();
}
