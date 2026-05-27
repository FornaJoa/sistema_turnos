import { analyticsToCsv, getOwnerAnalytics } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { findTenantBySlug } from "@/lib/tenant";
import { requireTenantOwner } from "@/lib/admin-auth";
import { handleRouteError, jsonError } from "@/lib/api-route";

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;
    const auth = await requireTenantOwner(tenantSlug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return jsonError("Local no encontrado.", 404);
    }

    const { searchParams } = new URL(request.url);
    const from = parseDateParam(
      searchParams.get("from"),
      new Date(Date.now() - 30 * 86400000)
    );
    const to = parseDateParam(searchParams.get("to"), new Date());

    if (!from || !to) {
      return jsonError("Rango de fechas inválido.", 400);
    }

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
  } catch (error) {
    return handleRouteError(error, "analytics");
  }
}
