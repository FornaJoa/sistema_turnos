import { requireStaffPanel } from "@/lib/tenant-auth";

export default async function BarberoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireStaffPanel(tenantSlug);
  return children;
}
