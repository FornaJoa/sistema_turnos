import { getTenantCatalogForApi } from "@/lib/catalog";
import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const catalog = await getTenantCatalogForApi(tenantSlug);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return handleRouteError(error, "catalog");
  }
}
