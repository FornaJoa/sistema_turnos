import { requireOwnerPanel } from "@/lib/tenant-auth";

export default async function OwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireOwnerPanel(tenantSlug);
  return children;
}
