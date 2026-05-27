import { getAvailableSlots } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { getCachedTenantCatalog } from "@/lib/catalog";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const catalog = await getCachedTenantCatalog(tenantSlug);
  const { searchParams } = new URL(request.url);

  const staffId = searchParams.get("staffId");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");

  if (!staffId || !serviceId || !date) {
    return NextResponse.json({ error: "Missing query params" }, { status: 400 });
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
}
