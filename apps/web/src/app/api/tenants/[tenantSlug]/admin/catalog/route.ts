import { fetchTenantCatalog } from "@/lib/catalog";
import { requireTenantAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await requireTenantAdmin(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const catalog = await fetchTenantCatalog(tenantSlug);
  return NextResponse.json(catalog);
}
