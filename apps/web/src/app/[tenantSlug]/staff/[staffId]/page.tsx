import { redirect } from "next/navigation";

export default async function LegacyStaffPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; staffId: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/barbero`);
}
