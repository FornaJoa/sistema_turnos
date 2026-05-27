"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  LoadingGrid,
  Select,
  StatusBadge,
} from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { fetchJson } from "@/lib/fetch-json";
import { formatDateTime, formatTimeOnly, getTodayDateString } from "@/lib/utils";

interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
}

export default function ReceptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [date, setDate] = useState("");
  const [clientReady, setClientReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<
    Array<{ staffId: string; staffName: string; nextAvailableSlot: string | null; slotsToday: number }>
  >([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>(null);
  const [walkInSlots, setWalkInSlots] = useState<Slot[]>([]);
  const [walkInSlotsLoading, setWalkInSlotsLoading] = useState(false);
  const [walkIn, setWalkIn] = useState({
    staffId: "",
    serviceId: "",
    startAt: "",
    clientName: "",
    clientPhone: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const loadReception = useCallback(async () => {
    if (!tenantSlug || !date) {
      return;
    }
    setLoading(true);
    const result = await fetchJson<{
      catalog: any;
      summary: typeof summary;
      appointments: any[];
    }>(`/api/tenants/${tenantSlug}/reception?date=${date}`);

    if (!result.ok) {
      setError(result.error);
      setCatalog(null);
      setLoading(false);
      return;
    }

    const data = result.data;
    setCatalog(data.catalog);
    setTimezone(data.catalog?.tenant?.timezone ?? timezone);
    if (!date) {
      setDate(getTodayDateString(data.catalog?.tenant?.timezone ?? timezone));
    }
    setSummary(data.summary ?? []);
    setAppointments(data.appointments ?? []);
    setError("");
    setWalkIn((prev) => ({
      ...prev,
      staffId: prev.staffId || data.catalog?.staff?.[0]?.id || "",
      serviceId: prev.serviceId || data.catalog?.services?.[0]?.id || "",
    }));
    setLoading(false);
  }, [tenantSlug, date, timezone]);

  const loadWalkInSlots = useCallback(async () => {
    if (!tenantSlug || !walkIn.staffId || !walkIn.serviceId) {
      return;
    }
    setWalkInSlotsLoading(true);
    try {
      const query = new URLSearchParams({
        date,
        staffId: walkIn.staffId,
        serviceId: walkIn.serviceId,
      });
      const result = await fetchJson<{ slots: Slot[] }>(
        `/api/tenants/${tenantSlug}/availability?${query.toString()}`
      );
      if (!result.ok) {
        setWalkInSlots([]);
        return;
      }
      const seen = new Set<string>();
      setWalkInSlots(
        (result.data.slots ?? [])
          .filter((slot: Slot) => slot.available)
          .filter((slot: Slot) => {
            if (seen.has(slot.startAt)) {
              return false;
            }
            seen.add(slot.startAt);
            return true;
          })
      );
    } finally {
      setWalkInSlotsLoading(false);
    }
  }, [tenantSlug, date, walkIn.staffId, walkIn.serviceId]);

  useEffect(() => {
    loadReception();
  }, [loadReception]);

  useEffect(() => {
    if (!tenantSlug || !walkIn.staffId || !walkIn.serviceId) {
      return;
    }
    const timer = window.setTimeout(() => {
      loadWalkInSlots();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [tenantSlug, walkIn.staffId, walkIn.serviceId, date, loadWalkInSlots]);

  async function createWalkIn(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/tenants/${tenantSlug}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walkIn),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Error");
      return;
    }
    setMessage("Turno walk-in creado");
    setWalkIn((prev) => ({ ...prev, clientName: "", clientPhone: "", startAt: "" }));
    loadReception();
  }

  async function updateStatus(appointmentId: string, status: string) {
    await fetch(`/api/tenants/${tenantSlug}/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, status }),
    });
    loadReception();
  }

  if (!tenantSlug || !clientReady || loading || !date) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <LoadingGrid count={4} />
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error || "No se pudo cargar recepción."}</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <PanelHeader
        tenantSlug={tenantSlug}
        active={`/${tenantSlug}/reception`}
        title="Recepción"
        subtitle="Disponibilidad del día, walk-in y agenda completa"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Quién está libre hoy</h2>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-3">
            {summary.map((row) => (
              <div key={row.staffId} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{row.staffName}</p>
                  <Badge tone="success">{row.slotsToday} slots</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  Próximo libre:{" "}
                  {row.nextAvailableSlot
                    ? formatDateTime(row.nextAvailableSlot, catalog.tenant.timezone)
                    : "Sin disponibilidad"}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Reserva walk-in</h2>
          <form className="mt-4 space-y-3" onSubmit={createWalkIn}>
            <div>
              <Label>Profesional</Label>
              <Select
                value={walkIn.staffId}
                onChange={(e) => setWalkIn({ ...walkIn, staffId: e.target.value, startAt: "" })}
              >
                {catalog.staff.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Servicio</Label>
              <Select
                value={walkIn.serviceId}
                onChange={(e) => setWalkIn({ ...walkIn, serviceId: e.target.value, startAt: "" })}
              >
                {catalog.services.map((service: any) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Horario disponible</Label>
              {walkInSlotsLoading ? (
                <LoadingGrid count={3} />
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {walkInSlots.map((slot) => (
                    <Button
                      key={slot.startAt}
                      type="button"
                      variant={walkIn.startAt === slot.startAt ? "primary" : "secondary"}
                      className="min-h-11"
                      onClick={() => setWalkIn({ ...walkIn, startAt: slot.startAt })}
                    >
                      {formatTimeOnly(slot.startAt, catalog.tenant.timezone)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Cliente</Label>
              <Input
                value={walkIn.clientName}
                onChange={(e) => setWalkIn({ ...walkIn, clientName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={walkIn.clientPhone}
                onChange={(e) => setWalkIn({ ...walkIn, clientPhone: e.target.value })}
              />
            </div>
            {message && <p className="text-sm text-green-700">{message}</p>}
            <Button type="submit" disabled={!walkIn.startAt}>
              Crear turno presencial
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold">Agenda del día</h2>
        <div className="mt-4 space-y-3">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4"
            >
              <div>
                <p className="font-medium">{appointment.clientName}</p>
                <p className="text-sm text-zinc-600">
                  {appointment.staff.name} · {appointment.service.name} ·{" "}
                  {formatDateTime(appointment.startAt, catalog.tenant.timezone)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={appointment.status} />
                <Button variant="secondary" onClick={() => updateStatus(appointment.id, "confirmed")}>
                  Confirmar
                </Button>
                <Button variant="danger" onClick={() => updateStatus(appointment.id, "cancelled")}>
                  Cancelar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
