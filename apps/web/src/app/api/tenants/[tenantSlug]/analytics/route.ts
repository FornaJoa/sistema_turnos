import { analyticsToCsv, getOwnerAnalytics } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { getTenantBySlug } from "@/lib/tenant";
import { requireTenantOwner } from "@/lib/admin-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await requireTenantOwner(tenantSlug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenant = await getTenantBySlug(tenantSlug);
  const { searchParams } = new URL(request.url);
  const from = new Date(searchParams.get("from") ?? new Date(Date.now() - 30 * 86400000));
  const to = new Date(searchParams.get("to") ?? new Date());

  const analytics = await getOwnerAnalytics({
    tenantId: tenant.id,
    from,
    to,
  });

  if (searchParams.get("format") === "csv") {
    const csv = analyticsToCsv(analytics);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="analytics-${tenantSlug}.csv"`,
      },
    });
  }

  return NextResponse.json({ analytics });
}
