import { requireTenantAccess } from "@/lib/tenant-auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantAccess(tenantSlug, "admin");
  return children;
}
