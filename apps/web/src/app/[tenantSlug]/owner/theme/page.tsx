import { redirect } from "next/navigation";

export default async function LegacyThemePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/admin/setup`);
}
