"use client";

import { useEffect, useState } from "react";
import { Button, Card, LoadingGrid, StatusBadge } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";
import { formatDateTime } from "@/lib/utils";

export default function PublicAppointmentPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; token: string }>;
}) {
  const [token, setToken] = useState("");
  const [appointment, setAppointment] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    params.then((value) => setToken(value.token));
  }, [params]);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    fetchJson<{ appointment: any }>(`/api/appointments/public/${token}`).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setAppointment(null);
      } else {
        setAppointment(result.data.appointment);
        setError("");
      }
      setLoading(false);
    });
  }, [token]);

  async function cancelAppointment() {
    setCancelling(true);
    setError("");

    const result = await fetchJson<{ appointment: any }>(`/api/appointments/public/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setCancelling(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAppointment(result.data.appointment);
    setMessage("Turno cancelado");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <LoadingGrid count={3} />
      </main>
    );
  }

  if (error || !appointment) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error || "Turno no encontrado."}</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <h1 className="text-2xl font-bold">Tu turno</h1>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <strong>Cliente:</strong> {appointment.clientName}
          </p>
          <p>
            <strong>Profesional:</strong> {appointment.staff.name}
          </p>
          <p>
            <strong>Servicio:</strong> {appointment.service.name}
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {formatDateTime(appointment.startAt, appointment.tenant.timezone)}
          </p>
          <StatusBadge status={appointment.status} />
        </div>
        {message && <p className="mt-3 text-green-700">{message}</p>}
        {appointment.status !== "cancelled" && (
          <Button className="mt-4" variant="danger" onClick={cancelAppointment} disabled={cancelling}>
            {cancelling ? "Cancelando..." : "Cancelar turno"}
          </Button>
        )}
      </Card>
    </main>
  );
}
