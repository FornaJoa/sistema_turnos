import { getCachedTenantCatalog } from "@/lib/catalog";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const catalog = await getCachedTenantCatalog(tenantSlug);
  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
