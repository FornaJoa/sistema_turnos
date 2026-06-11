"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, LoadingGrid, StatusBadge } from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { fetchJson } from "@/lib/fetch-json";

function defaultFromDate() {
  const date = new Date(Date.now() - 30 * 86400000);
  return date.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function OwnerAnalyticsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  useEffect(() => {
    if (!tenantSlug || !from || !to) {
      return;
    }

    setLoading(true);
    const query = new URLSearchParams({ from, to });
    fetchJson<{ analytics: unknown }>(`/api/tenants/${tenantSlug}/analytics?${query}`).then(
      (result) => {
        if (!result.ok) {
          setError(result.error);
          setAnalytics(null);
        } else {
          setAnalytics(result.data.analytics);
          setError("");
        }
        setLoading(false);
      }
    );
  }, [tenantSlug, from, to]);

  const maxStaffTotal = useMemo(() => {
    if (!analytics?.byStaff?.length) {
      return 1;
    }
    return Math.max(...analytics.byStaff.map((row: { total: number }) => row.total), 1);
  }, [analytics]);

  const peakHoursSorted = useMemo(() => {
    if (!analytics?.peakHours?.length) {
      return [];
    }
    return [...analytics.peakHours].sort(
      (a: { hour: number }, b: { hour: number }) => a.hour - b.hour
    );
  }, [analytics]);

  const maxPeakHour = useMemo(() => {
    if (!peakHoursSorted.length) {
      return 1;
    }
    return Math.max(...peakHoursSorted.map((row: { total: number }) => row.total), 1);
  }, [peakHoursSorted]);

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
            href={`/api/tenants/${tenantSlug}/analytics?format=csv&from=${from}&to=${to}`}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Exportar CSV
          </a>
        }
      />

      <Card>
        <h2 className="text-lg font-semibold">Período</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={() => { setFrom(defaultFromDate()); setTo(defaultToDate()); }}>
              Últimos 30 días
            </Button>
          </div>
        </div>
      </Card>

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
          <div className="mt-3 space-y-2">
            {analytics.statusCounts.map((row: { status: string; count: number }) => (
              <div key={row.status} className="flex items-center justify-between gap-3">
                <StatusBadge status={row.status} />
                <span className="text-lg font-semibold tabular-nums text-zinc-900">{row.count}</span>
              </div>
            ))}
            {analytics.statusCounts.length === 0 && (
              <p className="text-sm text-zinc-500">Sin turnos en el período.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Por profesional</h2>
          <div className="mt-4 space-y-3">
            {analytics.byStaff.length === 0 && (
              <p className="text-sm text-zinc-500">Sin turnos en el período.</p>
            )}
            {analytics.byStaff.map((row: any) => (
              <div key={row.staffId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{row.staffName}</span>
                  <span className="text-zinc-600">
                    {row.total} total · {row.completed} completados
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${Math.round((row.total / maxStaffTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Horas pico</h2>
          <div className="mt-4 space-y-2">
            {peakHoursSorted.length === 0 && (
              <p className="text-sm text-zinc-500">Sin turnos en el período.</p>
            )}
            {peakHoursSorted.map((row: { hour: number; total: number }) => (
              <div key={row.hour} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-sm tabular-nums text-zinc-600">
                  {String(row.hour).padStart(2, "0")}:00
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.round((row.total / maxPeakHour) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm tabular-nums text-zinc-700">{row.total}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold">Servicios más reservados</h2>
        <div className="mt-4 space-y-2">
          {analytics.byService.length === 0 && (
            <p className="text-sm text-zinc-500">Sin turnos en el período.</p>
          )}
          {analytics.byService.map((row: any) => (
            <div key={row.serviceId} className="rounded-lg border border-zinc-200 p-3">
              <p className="font-medium">{row.serviceName}</p>
              <p className="text-sm text-zinc-600">{row.total} turnos</p>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
