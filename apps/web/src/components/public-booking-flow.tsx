"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { Badge, Button, Card, Input, Label, LoadingGrid, Select, StepIndicator } from "@/components/ui";
import type { TenantCatalog } from "@/lib/catalog";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney, formatTimeOnly } from "@/lib/utils";

interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
}

function uniqueAvailableSlots(slots: Slot[]) {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    if (!slot.available || seen.has(slot.startAt)) {
      return false;
    }
    seen.add(slot.startAt);
    return true;
  });
}

export function PublicBookingFlow({
  tenantSlug,
  initialCatalog,
  initialDate,
}: {
  tenantSlug: string;
  initialCatalog?: TenantCatalog;
  initialDate: string;
}) {
  const [catalog, setCatalog] = useState<TenantCatalog | null>(initialCatalog ?? null);
  const [serviceId, setServiceId] = useState(initialCatalog?.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(
    initialCatalog?.staff.find((m) => m.serviceIds.includes(initialCatalog.services[0]?.id ?? ""))?.id ??
      initialCatalog?.staff[0]?.id ??
      ""
  );
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [clientReady, setClientReady] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [sessionId] = useState(() => nanoid());
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (initialCatalog) {
      return;
    }
    fetchJson<TenantCatalog>(`/api/tenants/${tenantSlug}/catalog`)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const data = result.data;
        setCatalog(data);
        setServiceId(data.services[0]?.id ?? "");
        setStaffId(data.staff[0]?.id ?? "");
      });
  }, [tenantSlug, initialCatalog]);

  const availableStaff = useMemo(() => {
    if (!catalog || !serviceId) {
      return catalog?.staff ?? [];
    }
    return catalog.staff.filter((member) => member.serviceIds.includes(serviceId));
  }, [catalog, serviceId]);

  useEffect(() => {
    if (availableStaff.some((member) => member.id === staffId)) {
      return;
    }
    setStaffId(availableStaff[0]?.id ?? "");
  }, [availableStaff, staffId]);

  useEffect(() => {
    if (!clientReady || !serviceId || !staffId || !date) {
      return;
    }

    const controller = new AbortController();
    setSlotsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchJson<{ slots: Slot[] }>(
          `/api/tenants/${tenantSlug}/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`,
          { signal: controller.signal }
        );
        if (!result.ok) {
          setSlots([]);
          setError(result.error);
          return;
        }
        setSlots(result.data.slots ?? []);
        setError("");
      } catch {
        if (!controller.signal.aborted) {
          setSlots([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSlotsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [tenantSlug, serviceId, staffId, date, clientReady]);

  useEffect(() => {
    if (!holdExpiresAt) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setHoldId(null);
        setSelectedSlot(null);
        setMessage("");
        setError("La reserva temporal expiró. Elegí el horario nuevamente.");
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [holdExpiresAt]);

  const reserveSlot = useCallback(
    async (slot: Slot) => {
      setError("");
      setLoading(true);
      setSelectedSlot(slot);

      const response = await fetch(`/api/tenants/${tenantSlug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hold",
          staffId,
          serviceId,
          startAt: slot.startAt,
          sessionId,
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? "No se pudo reservar");
        setSelectedSlot(null);
        return;
      }

      setHoldId(data.holdId);
      setHoldExpiresAt(new Date(data.expiresAt).getTime());
      setMessage("Completá tus datos para confirmar.");
    },
    [tenantSlug, staffId, serviceId, sessionId]
  );

  async function confirmBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!holdId) {
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch(`/api/tenants/${tenantSlug}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        holdId,
        clientName,
        clientEmail,
        clientPhone,
      }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo confirmar");
      return;
    }

    setConfirmedToken(data.publicToken);
    setMessage("Turno confirmado. Revisá tu email.");
  }

  const availableSlots = uniqueAvailableSlots(slots);

  if (!catalog) {
    return <LoadingGrid count={4} />;
  }

  if (confirmedToken) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-white to-green-50">
        <h2 className="text-2xl font-bold text-zinc-900">Turno confirmado</h2>
        <p className="mt-2 text-zinc-600">{message}</p>
        <a
          className="mt-4 inline-block font-medium text-[var(--brand)] underline"
          href={`/${tenantSlug}/turno/${confirmedToken}`}
        >
          Ver detalle del turno
        </a>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <StepIndicator step={1} label="Servicio y profesional" />
        <div className="mt-4 space-y-4">
          <div>
            <Label>Servicio</Label>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {catalog.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.durationMinutes} min) - {formatMoney(service.priceCents)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Profesional</Label>
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {availableStaff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <StepIndicator step={2} label="Horario disponible" />
        <p className="mt-2 text-sm text-zinc-500">
          {availableSlots.length > 0
            ? `${availableSlots.length} horarios disponibles`
            : "Elegí otra fecha si no hay turnos"}
        </p>
        <div className="mt-4">
          {!clientReady || slotsLoading ? (
            <LoadingGrid />
          ) : availableSlots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              No hay horarios disponibles para esta fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.startAt}
                  variant={selectedSlot?.startAt === slot.startAt ? "primary" : "outline"}
                  className="min-h-11 px-2"
                  onClick={() => reserveSlot(slot)}
                  disabled={loading}
                >
                  {formatTimeOnly(slot.startAt, catalog.tenant.timezone)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {holdId && (
          <form className="mt-6 space-y-3 border-t border-zinc-200 pt-4" onSubmit={confirmBooking}>
            <div className="flex items-center justify-between gap-3">
              <StepIndicator step={3} label="Tus datos" />
              {secondsLeft > 0 && (
                <Badge tone="warning">
                  Expira en {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </Badge>
              )}
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && !error && <Badge tone="success">{message}</Badge>}
            <Button type="submit" disabled={loading || secondsLeft === 0}>
              Confirmar turno
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
