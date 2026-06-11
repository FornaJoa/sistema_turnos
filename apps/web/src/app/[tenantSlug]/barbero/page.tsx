"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { StaffOfferingsEditor } from "@/components/staff-offerings-editor";
import { StaffProfileEditor } from "@/components/staff-profile-editor";
import { StaffSchedulesEditor } from "@/components/staff-schedules-editor";
import { StaffScheduleExceptionsEditor } from "@/components/staff-schedule-exceptions-editor";
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  async function loadData() {
    if (!tenantSlug) {
      return;
    }

    setLoading(true);
    setError("");

    const meResult = await fetchJson<{
      staffProfile: { id: string; name: string } | null;
      tenant: { timezone: string };
    }>(`/api/tenants/${tenantSlug}/me`);

    if (!meResult.ok) {
      setError(meResult.error);
      setProfile(null);
      setAppointments([]);
      setLoading(false);
      return;
    }

    const meData = meResult.data;
    setProfile(meData);

    if (!meData.staffProfile) {
      setError("Tu usuario no está vinculado a un perfil de profesional. Pedile al admin que te asigne.");
      setAppointments([]);
      setLoading(false);
      return;
    }

    const apptResult = await fetchJson<{ appointments: any[] }>(
      `/api/tenants/${tenantSlug}/staff/${meData.staffProfile.id}/appointments`
    );
    setAppointments(apptResult.ok ? apptResult.data.appointments ?? [] : []);
    if (!apptResult.ok) {
      setError(apptResult.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [tenantSlug]);

  async function updateStatus(appointmentId: string, status: string) {
    setMessage("");
    setError("");

    const result = await fetchJson(`/api/tenants/${tenantSlug}/appointments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, status }),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Turno actualizado.");
    loadData();
  }

  if (!tenantSlug || loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-zinc-500">Cargando agenda...</p>
      </main>
    );
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

      {profile?.staffProfile?.id && (
        <>
          <Card>
            <h2 className="text-xl font-semibold">Mi perfil público</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Foto, bio y redes que ven los clientes al reservar.
            </p>
            <div className="mt-4">
              <StaffProfileEditor
                tenantSlug={tenantSlug}
                staffId={profile.staffProfile.id}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">Mis servicios y precios</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Si tardás más o menos que el valor base del local, ajustá la duración acá. La agenda
              bloquea el tiempo real de cada servicio.
            </p>
            <div className="mt-4">
              <StaffOfferingsEditor
                tenantSlug={tenantSlug}
                staffId={profile.staffProfile.id}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">Mis horarios</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Actualizá tu disponibilidad semanal y avisá feriados o días especiales.
            </p>
            <div className="mt-4 space-y-6">
              <StaffSchedulesEditor
                tenantSlug={tenantSlug}
                staffId={profile.staffProfile.id}
                apiScope="staff"
              />
              <StaffScheduleExceptionsEditor
                tenantSlug={tenantSlug}
                staffId={profile.staffProfile.id}
                apiScope="staff"
              />
            </div>
          </Card>
        </>
      )}

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
