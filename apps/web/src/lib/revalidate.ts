import { revalidateTag } from "next/cache";

export function revalidateTenant(tenantSlug: string) {
  revalidateTag(`tenant-${tenantSlug}`);
}
