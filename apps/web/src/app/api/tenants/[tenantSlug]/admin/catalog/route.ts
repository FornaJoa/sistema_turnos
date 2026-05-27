import { getTenantCatalogForApi } from "@/lib/catalog";
import { requireTenantAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const auth = await requireTenantAdmin(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const catalog = await getTenantCatalogForApi(tenantSlug);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    return NextResponse.json(catalog);
  } catch (error) {
    return handleRouteError(error, "admin/catalog");
  }
}
