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
  const [sessionId, setSessionId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [reservingSlotStart, setReservingSlotStart] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(nanoid());
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

  const selectedOffering = useMemo(() => {
    if (!catalog || !staffId || !serviceId) {
      return null;
    }
    const member = catalog.staff.find((row) => row.id === staffId);
    return member?.offerings?.find((row) => row.serviceId === serviceId) ?? null;
  }, [catalog, staffId, serviceId]);

  const selectedService = useMemo(
    () => catalog?.services.find((service) => service.id === serviceId),
    [catalog, serviceId]
  );

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
      if (!sessionId) {
        setError("Cargando la reserva, intentá de nuevo en un segundo.");
        return;
      }

      setError("");
      setMessage("");
      setLoading(true);
      setReservingSlotStart(slot.startAt);

      const result = await fetchJson<{ holdId: string; expiresAt: string }>(
        `/api/tenants/${tenantSlug}/bookings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "hold",
            staffId,
            serviceId,
            startAt: slot.startAt,
            sessionId,
          }),
        }
      );

      setLoading(false);
      setReservingSlotStart(null);

      if (!result.ok) {
        setError(result.error);
        setSelectedSlot(null);
        return;
      }

      setSelectedSlot(slot);
      setHoldId(result.data.holdId);
      setHoldExpiresAt(new Date(result.data.expiresAt).getTime());
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

    const result = await fetchJson<{ publicToken: string }>(`/api/tenants/${tenantSlug}/bookings`, {
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

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmedToken(result.data.publicToken);
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
                  {service.name}
                </option>
              ))}
            </Select>
            {selectedOffering ? (
              <p className="mt-1 text-sm text-zinc-600">
                Con {availableStaff.find((m) => m.id === staffId)?.name ?? "este profesional"}:{" "}
                {selectedOffering.durationMinutes} min · {formatMoney(selectedOffering.priceCents)}
              </p>
            ) : selectedService ? (
              <p className="mt-1 text-sm text-zinc-500">
                Desde {selectedService.durationMinutes} min ·{" "}
                {formatMoney(selectedService.priceCents)}
              </p>
            ) : null}
          </div>
          <div>
            <Label>Profesional</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {availableStaff.map((member) => {
                const selected = member.id === staffId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setStaffId(member.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-[var(--brand)] bg-[var(--brand)]/5 ring-2 ring-[var(--brand)]/30"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-14 w-14 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-900">{member.name}</p>
                        {member.bio && (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{member.bio}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-[var(--brand)]">
                          {member.instagramUrl && (
                            <span>Instagram</span>
                          )}
                          {member.tiktokUrl && <span>TikTok</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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
          {selectedOffering
            ? `Duración del turno: ${selectedOffering.durationMinutes} minutos. `
            : ""}
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
                  disabled={loading || !sessionId}
                >
                  {reservingSlotStart === slot.startAt
                    ? "Reservando..."
                    : formatTimeOnly(slot.startAt, catalog.tenant.timezone)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {error && !holdId && <p className="mt-4 text-sm text-red-600">{error}</p>}

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
