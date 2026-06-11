"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type DayRow = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function toInputTime(value: string) {
  return value.slice(0, 5);
}

function defaultRows(): DayRow[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

export function StaffSchedulesEditor({
  tenantSlug,
  staffId,
}: {
  tenantSlug: string;
  staffId: string;
}) {
  const [rows, setRows] = useState<DayRow[]>(defaultRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tenantSlug || !staffId) {
      return;
    }

    setLoading(true);
    fetchJson<{ schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }> }>(
      `/api/tenants/${tenantSlug}/admin/staff/${staffId}/schedules`
    ).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const next = defaultRows().map((row) => ({ ...row, enabled: false }));
      for (const schedule of result.data.schedules) {
        const row = next.find((item) => item.dayOfWeek === schedule.dayOfWeek);
        if (row) {
          row.enabled = true;
          row.startTime = toInputTime(schedule.startTime);
          row.endTime = toInputTime(schedule.endTime);
        }
      }

      setRows(next);
      setError("");
      setLoading(false);
    });
  }, [tenantSlug, staffId]);

  async function saveSchedules() {
    setSaving(true);
    setError("");
    setMessage("");

    const windows = rows
      .filter((row) => row.enabled)
      .map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
      }));

    const result = await fetchJson(
      `/api/tenants/${tenantSlug}/admin/staff/${staffId}/schedules`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows }),
      }
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Horarios semanales guardados.");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando horarios...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Definí en qué días y franjas horarias atiende este profesional.
      </p>
      {rows.map((row) => (
        <div key={row.dayOfWeek} className="rounded-xl border border-zinc-200 p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.dayOfWeek === row.dayOfWeek
                      ? { ...item, enabled: event.target.checked }
                      : item
                  )
                )
              }
            />
            <span className="font-medium">{DAY_LABELS[row.dayOfWeek]}</span>
          </label>
          {row.enabled && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Desde</Label>
                <Input
                  type="time"
                  value={row.startTime}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.dayOfWeek === row.dayOfWeek
                          ? { ...item, startTime: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input
                  type="time"
                  value={row.endTime}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.dayOfWeek === row.dayOfWeek
                          ? { ...item, endTime: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <Button type="button" onClick={saveSchedules} disabled={saving}>
        {saving ? "Guardando..." : "Guardar horarios semanales"}
      </Button>
    </div>
  );
}
