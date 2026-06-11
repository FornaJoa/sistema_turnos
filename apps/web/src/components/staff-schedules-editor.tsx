"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type ScheduleWindow = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function toInputTime(value: string) {
  return value.slice(0, 5);
}

function newWindow(dayOfWeek: number): ScheduleWindow {
  return {
    key: `${dayOfWeek}-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek,
    startTime: "09:00",
    endTime: "18:00",
  };
}

export function StaffSchedulesEditor({
  tenantSlug,
  staffId,
  apiScope = "admin",
}: {
  tenantSlug: string;
  staffId: string;
  apiScope?: "admin" | "staff";
}) {
  const [windows, setWindows] = useState<ScheduleWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const apiBase =
    apiScope === "admin"
      ? `/api/tenants/${tenantSlug}/admin/staff/${staffId}/schedules`
      : `/api/tenants/${tenantSlug}/staff/${staffId}/schedules`;

  const windowsByDay = useMemo(() => {
    const grouped = new Map<number, ScheduleWindow[]>();
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      grouped.set(day, windows.filter((window) => window.dayOfWeek === day));
    }
    return grouped;
  }, [windows]);

  useEffect(() => {
    if (!tenantSlug || !staffId) {
      return;
    }

    setLoading(true);
    fetchJson<{ schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }> }>(
      apiBase
    ).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setWindows(
        result.data.schedules.map((schedule) => ({
          key: `${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}`,
          dayOfWeek: schedule.dayOfWeek,
          startTime: toInputTime(schedule.startTime),
          endTime: toInputTime(schedule.endTime),
        }))
      );
      setError("");
      setLoading(false);
    });
  }, [tenantSlug, staffId, apiBase]);

  async function saveSchedules() {
    setSaving(true);
    setError("");
    setMessage("");

    const payload = windows.map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
    }));

    const result = await fetchJson(apiBase, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows: payload }),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Horarios semanales guardados.");
  }

  function updateWindow(key: string, patch: Partial<ScheduleWindow>) {
    setWindows((current) =>
      current.map((window) => (window.key === key ? { ...window, ...patch } : window))
    );
  }

  function removeWindow(key: string) {
    setWindows((current) => current.filter((window) => window.key !== key));
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando horarios...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Podés definir varias franjas por día (por ejemplo mañana y tarde).
      </p>
      {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
        const dayWindows = windowsByDay.get(dayOfWeek) ?? [];
        return (
          <div key={dayOfWeek} className="rounded-xl border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">{DAY_LABELS[dayOfWeek]}</span>
              <Button type="button" variant="ghost" onClick={() => setWindows((c) => [...c, newWindow(dayOfWeek)])}>
                + Franja
              </Button>
            </div>
            {dayWindows.length === 0 && (
              <p className="text-sm text-zinc-500">Sin horario este día.</p>
            )}
            {dayWindows.map((window) => (
              <div key={window.key} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <Label>Desde</Label>
                  <Input
                    type="time"
                    value={window.startTime}
                    onChange={(event) => updateWindow(window.key, { startTime: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input
                    type="time"
                    value={window.endTime}
                    onChange={(event) => updateWindow(window.key, { endTime: event.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="danger" onClick={() => removeWindow(window.key)}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <Button type="button" onClick={saveSchedules} disabled={saving}>
        {saving ? "Guardando..." : "Guardar horarios semanales"}
      </Button>
    </div>
  );
}
