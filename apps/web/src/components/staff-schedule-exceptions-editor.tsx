"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

type ExceptionRow = {
  key: string;
  date: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
  reason: string;
};

function newException(): ExceptionRow {
  return {
    key: Math.random().toString(36).slice(2, 10),
    date: "",
    isClosed: true,
    startTime: "09:00",
    endTime: "13:00",
    reason: "",
  };
}

export function StaffScheduleExceptionsEditor({
  tenantSlug,
  staffId,
  apiScope = "admin",
}: {
  tenantSlug: string;
  staffId: string;
  apiScope?: "admin" | "staff";
}) {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const apiBase =
    apiScope === "admin"
      ? `/api/tenants/${tenantSlug}/admin/staff/${staffId}/exceptions`
      : `/api/tenants/${tenantSlug}/staff/${staffId}/exceptions`;

  useEffect(() => {
    if (!tenantSlug || !staffId) {
      return;
    }

    setLoading(true);
    fetchJson<{
      exceptions: Array<{
        date: string;
        isClosed: boolean;
        startTime: string | null;
        endTime: string | null;
        reason: string | null;
      }>;
    }>(apiBase).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setRows(
        result.data.exceptions.map((exception) => ({
          key: exception.date,
          date: exception.date,
          isClosed: exception.isClosed,
          startTime: exception.startTime?.slice(0, 5) ?? "09:00",
          endTime: exception.endTime?.slice(0, 5) ?? "13:00",
          reason: exception.reason ?? "",
        }))
      );
      setError("");
      setLoading(false);
    });
  }, [tenantSlug, staffId, apiBase]);

  async function saveExceptions() {
    setSaving(true);
    setError("");
    setMessage("");

    const payload = rows.map((row) => ({
      date: row.date,
      isClosed: row.isClosed,
      startTime: row.isClosed ? null : row.startTime,
      endTime: row.isClosed ? null : row.endTime,
      reason: row.reason || null,
    }));

    const result = await fetchJson(apiBase, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exceptions: payload }),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Excepciones guardadas.");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando excepciones...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Feriados, vacaciones o días con horario distinto al semanal.
      </p>
      {rows.map((row) => (
        <div key={row.key} className="rounded-xl border border-zinc-200 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={row.date}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, date: event.target.value } : item
                    )
                  )
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.isClosed}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, isClosed: event.target.checked } : item
                      )
                    )
                  }
                />
                Cerrado todo el día
              </label>
            </div>
          </div>
          {!row.isClosed && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Desde</Label>
                <Input
                  type="time"
                  value={row.startTime}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, startTime: event.target.value } : item
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
                        item.key === row.key ? { ...item, endTime: event.target.value } : item
                      )
                    )
                  }
                />
              </div>
            </div>
          )}
          <div className="mt-2">
            <Label>Motivo (opcional)</Label>
            <Input
              value={row.reason}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.key === row.key ? { ...item, reason: event.target.value } : item
                  )
                )
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
          >
            Eliminar
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, newException()])}>
        Agregar excepción
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <Button type="button" onClick={saveExceptions} disabled={saving}>
        {saving ? "Guardando..." : "Guardar excepciones"}
      </Button>
    </div>
  );
}
