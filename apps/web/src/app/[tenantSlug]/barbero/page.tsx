"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { fetchJson } from "@/lib/fetch-json";
import { formatDateTime } from "@/lib/utils";

export default function BarberPanelPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  async function loadData() {
    if (!tenantSlug) {
      return;
    }

    const meResult = await fetchJson<{
      staffProfile: { id: string; name: string } | null;
      tenant: { timezone: string };
    }>(`/api/tenants/${tenantSlug}/me`);

    if (!meResult.ok) {
      setError(meResult.error);
      setProfile(null);
      return;
    }

    const meData = meResult.data;
    setProfile(meData);

    if (!meData.staffProfile) {
      setError("Tu usuario no está vinculado a un perfil de profesional. Pedile al admin que te asigne.");
      return;
    }

    const apptResult = await fetchJson<{ appointments: any[] }>(
      `/api/tenants/${tenantSlug}/staff/${meData.staffProfile.id}/appointments`
    );
    setAppointments(apptResult.ok ? apptResult.data.appointments ?? [] : []);
  }

  useEffect(() => {
    loadData();
  }, [tenantSlug]);

  async function updateStatus(appointmentId: string, status: string) {
    setMessage("");
    const response = await fetch(`/api/tenants/${tenantSlug}/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, status }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo actualizar");
      return;
    }

    setMessage("Turno actualizado.");
    loadData();
  }

  if (!tenantSlug) {
    return <main className="p-6">Cargando...</main>;
  }

  if (error && !profile?.staffProfile) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error}</p>
          <Link href={`/login?next=/${tenantSlug}/barbero`} className="mt-3 inline-block text-sm font-medium underline">
            Iniciar sesión
          </Link>
        </Card>
      </main>
    );
  }

  const timezone = profile?.tenant?.timezone ?? "UTC";
  const staffName = profile?.staffProfile?.name ?? "Profesional";
  const pending = appointments.filter((a) => a.status === "pending").length;
  const today = appointments.filter((a) => {
    const d = new Date(a.startAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <PanelHeader
        tenantSlug={tenantSlug}
        active={`/${tenantSlug}/barbero`}
        title={`Hola, ${staffName}`}
        subtitle="Gestioná tus turnos: confirmar, completar o cancelar"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">Turnos hoy</p>
          <p className="text-3xl font-bold">{today.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Pendientes</p>
          <p className="text-3xl font-bold">{pending}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Próximos</p>
          <p className="text-3xl font-bold">{appointments.length}</p>
        </Card>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <h2 className="text-xl font-semibold">Mi agenda</h2>
        <div className="mt-4 space-y-3">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4"
            >
              <div>
                <p className="font-medium">{appointment.clientName}</p>
                <p className="text-sm text-zinc-600">
                  {appointment.service.name} · {formatDateTime(appointment.startAt, timezone)}
                </p>
                {appointment.clientPhone && (
                  <p className="text-sm text-zinc-500">Tel: {appointment.clientPhone}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={appointment.status} />
                {appointment.status === "pending" && (
                  <Button variant="secondary" onClick={() => updateStatus(appointment.id, "confirmed")}>
                    Confirmar
                  </Button>
                )}
                {["pending", "confirmed"].includes(appointment.status) && (
                  <>
                    <Button variant="secondary" onClick={() => updateStatus(appointment.id, "completed")}>
                      Completar
                    </Button>
                    <Button variant="danger" onClick={() => updateStatus(appointment.id, "cancelled")}>
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {appointments.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-zinc-500">
              No tenés turnos próximos asignados.
            </p>
          )}
        </div>
      </Card>
    </main>
  );
}
