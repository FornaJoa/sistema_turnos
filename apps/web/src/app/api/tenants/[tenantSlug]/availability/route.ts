import { getAvailableSlots } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { getTenantCatalogForApi } from "@/lib/catalog";
import { handleRouteError, jsonError } from "@/lib/api-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const catalog = await getTenantCatalogForApi(tenantSlug);
    if (!catalog) {
      return jsonError("Local no encontrado.", 404);
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const serviceId = searchParams.get("serviceId");
    const date = searchParams.get("date");

    if (!staffId || !serviceId || !date) {
      return jsonError("Faltan parámetros de consulta.", 400);
    }

    const slots = await getAvailableSlots({
      tenantId: catalog.tenant.id,
      staffId,
      serviceId,
      date,
      timezone: catalog.tenant.timezone,
    });

    return NextResponse.json(
      { slots },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    return handleRouteError(error, "availability");
  }
}
