"use client";

import { useEffect, useState } from "react";
import { Card, LoadingGrid } from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { fetchJson } from "@/lib/fetch-json";

export default function OwnerAnalyticsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }
    setLoading(true);
    fetchJson<{ analytics: unknown }>(`/api/tenants/${tenantSlug}/analytics`).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setAnalytics(null);
      } else {
        setAnalytics(result.data.analytics);
        setError("");
      }
      setLoading(false);
    });
  }, [tenantSlug]);

  if (!tenantSlug || loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <LoadingGrid count={4} />
      </main>
    );
  }

  if (error || !analytics) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error || "No se pudieron cargar las estadísticas."}</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <PanelHeader
        tenantSlug={tenantSlug}
        active={`/${tenantSlug}/owner`}
        title="Estadísticas del dueño"
        subtitle="Turnos, ocupación y clientes"
        actions={
          <a
            href={`/api/tenants/${tenantSlug}/analytics?format=csv`}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Exportar CSV
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-zinc-500">Turnos totales</p>
          <p className="text-3xl font-bold">{analytics.totalAppointments}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Clientes nuevos</p>
          <p className="text-3xl font-bold">{analytics.newClients}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Clientes recurrentes</p>
          <p className="text-3xl font-bold">{analytics.recurringClients}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Estados</p>
          <div className="mt-2 space-y-1 text-sm">
            {analytics.statusCounts.map((row: any) => (
              <p key={row.status}>
                {row.status}: {row.count}
              </p>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Por profesional</h2>
          <div className="mt-4 space-y-2">
            {analytics.byStaff.map((row: any) => (
              <div key={row.staffId} className="rounded-lg border border-zinc-200 p-3">
                <p className="font-medium">{row.staffName}</p>
                <p className="text-sm text-zinc-600">
                  Total {row.total} · Completados {row.completed}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Servicios más reservados</h2>
          <div className="mt-4 space-y-2">
            {analytics.byService.map((row: any) => (
              <div key={row.serviceId} className="rounded-lg border border-zinc-200 p-3">
                <p className="font-medium">{row.serviceName}</p>
                <p className="text-sm text-zinc-600">{row.total} turnos</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
