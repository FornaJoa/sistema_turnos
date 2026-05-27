import { requireTenantAccess } from "@/lib/tenant-auth";

export default async function ReceptionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantAccess(tenantSlug, "reception");
  return children;
}
