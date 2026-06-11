"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";

type Offering = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number | null;
  defaultDurationMinutes: number;
  defaultPriceCents: number | null;
  isCustomDuration: boolean;
  isCustomPrice: boolean;
};

type OfferingForm = {
  serviceId: string;
  serviceName: string;
  durationMinutes: string;
  pricePesos: string;
  defaultDurationMinutes: number;
  defaultPriceCents: number | null;
};

export function StaffOfferingsEditor({
  tenantSlug,
  staffId,
  canEdit = true,
  onSaved,
}: {
  tenantSlug: string;
  staffId: string;
  canEdit?: boolean;
  onSaved?: () => void;
}) {
  const [offerings, setOfferings] = useState<OfferingForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tenantSlug || !staffId) {
      return;
    }

    setLoading(true);
    fetchJson<{ offerings: Offering[] }>(
      `/api/tenants/${tenantSlug}/staff/${staffId}/offerings`
    ).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setOfferings([]);
        setLoading(false);
        return;
      }

      setOfferings(
        result.data.offerings.map((offering) => ({
          serviceId: offering.serviceId,
          serviceName: offering.serviceName,
          durationMinutes: String(offering.durationMinutes),
          pricePesos: offering.priceCents != null ? String(offering.priceCents / 100) : "",
          defaultDurationMinutes: offering.defaultDurationMinutes,
          defaultPriceCents: offering.defaultPriceCents,
        }))
      );
      setError("");
      setLoading(false);
    });
  }, [tenantSlug, staffId]);

  async function saveOfferings() {
    setSaving(true);
    setError("");
    setMessage("");

    const result = await fetchJson<{ offerings: Offering[] }>(
      `/api/tenants/${tenantSlug}/staff/${staffId}/offerings`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerings: offerings.map((offering) => {
            const duration = offering.durationMinutes ? Number(offering.durationMinutes) : null;
            const price = offering.pricePesos !== "" ? Number(offering.pricePesos) : null;
            const defaultPrice =
              offering.defaultPriceCents != null ? offering.defaultPriceCents / 100 : null;

            return {
              serviceId: offering.serviceId,
              durationMinutes:
                duration == null || duration === offering.defaultDurationMinutes
                  ? null
                  : duration,
              pricePesos: price == null || price === defaultPrice ? null : price,
            };
          }),
        }),
      }
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Servicios actualizados. Los horarios se recalculan con la nueva duración.");
    onSaved?.();
  }

  function resetOffering(serviceId: string) {
    setOfferings((current) =>
      current.map((offering) =>
        offering.serviceId === serviceId
          ? {
              ...offering,
              durationMinutes: String(offering.defaultDurationMinutes),
              pricePesos:
                offering.defaultPriceCents != null
                  ? String(offering.defaultPriceCents / 100)
                  : "",
            }
          : offering
      )
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando servicios...</p>;
  }

  if (offerings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Este profesional no tiene servicios asignados todavía.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Cada profesional puede tener su propia duración y precio. Eso define cuánto tiempo
        bloquea cada turno en la agenda.
      </p>
      {offerings.map((offering) => (
        <div key={offering.serviceId} className="rounded-xl border border-zinc-200 p-3">
          <p className="font-medium">{offering.serviceName}</p>
          <p className="text-xs text-zinc-500">
            Base del local: {offering.defaultDurationMinutes} min ·{" "}
            {formatMoney(offering.defaultPriceCents)}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Duración (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={offering.durationMinutes}
                disabled={!canEdit}
                onChange={(e) =>
                  setOfferings((current) =>
                    current.map((row) =>
                      row.serviceId === offering.serviceId
                        ? { ...row, durationMinutes: e.target.value }
                        : row
                    )
                  )
                }
              />
            </div>
            <div>
              <Label>Precio (pesos)</Label>
              <Input
                type="number"
                min={0}
                value={offering.pricePesos}
                disabled={!canEdit}
                onChange={(e) =>
                  setOfferings((current) =>
                    current.map((row) =>
                      row.serviceId === offering.serviceId
                        ? { ...row, pricePesos: e.target.value }
                        : row
                    )
                  )
                }
              />
            </div>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={() => resetOffering(offering.serviceId)}
            >
              Usar valores base del local
            </Button>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {canEdit && (
        <Button type="button" onClick={saveOfferings} disabled={saving}>
          {saving ? "Guardando..." : "Guardar servicios del profesional"}
        </Button>
      )}
    </div>
  );
}
