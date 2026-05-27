"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { PanelHeader } from "@/components/panel-nav";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";

type StaffItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  serviceIds: string[];
};

type ServiceItem = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
};

export default function AdminPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [catalog, setCatalog] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", phone: "" });
  const [serviceForm, setServiceForm] = useState({
    name: "",
    durationMinutes: 30,
    pricePesos: "",
  });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({ name: "", email: "", phone: "" });
  const [editServiceForm, setEditServiceForm] = useState({
    name: "",
    durationMinutes: 30,
    pricePesos: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  async function loadCatalog() {
    if (!tenantSlug) {
      return;
    }
    setLoading(true);
    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/catalog`);
    if (!result.ok) {
      setError(result.error);
      setCatalog(null);
      setLoading(false);
      return;
    }
    setCatalog(result.data);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    loadCatalog();
  }, [tenantSlug]);

  async function createStaff(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffForm),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Profesional "${staffForm.name}" agregado con horario Lun–Vie 9:00–18:00.`);
    setStaffForm({ name: "", email: "", phone: "" });
    loadCatalog();
  }

  async function createService(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serviceForm),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Servicio "${serviceForm.name}" agregado.`);
    setServiceForm({ name: "", durationMinutes: 30, pricePesos: "" });
    loadCatalog();
  }

  function startEditStaff(member: StaffItem) {
    setEditingStaffId(member.id);
    setEditStaffForm({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
    });
  }

  function startEditService(service: ServiceItem) {
    setEditingServiceId(service.id);
    setEditServiceForm({
      name: service.name,
      durationMinutes: service.durationMinutes,
      pricePesos: service.priceCents ? String(service.priceCents / 100) : "",
    });
  }

  async function saveStaffEdit(staffId: string) {
    setSaving(true);
    setError("");
    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editStaffForm),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEditingStaffId(null);
    setMessage("Profesional actualizado.");
    loadCatalog();
  }

  async function deleteStaff(staffId: string, name: string) {
    if (!confirm(`¿Desactivar a ${name}? No aparecerá en reservas nuevas.`)) {
      return;
    }

    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/staff/${staffId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Profesional "${name}" desactivado.`);
    loadCatalog();
  }

  async function saveServiceEdit(serviceId: string) {
    setSaving(true);
    setError("");
    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editServiceForm),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEditingServiceId(null);
    setMessage("Servicio actualizado.");
    loadCatalog();
  }

  async function deleteService(serviceId: string, name: string) {
    if (!confirm(`¿Desactivar el servicio "${name}"?`)) {
      return;
    }

    const result = await fetchJson(`/api/tenants/${tenantSlug}/admin/services/${serviceId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Servicio "${name}" desactivado.`);
    loadCatalog();
  }

  if (!tenantSlug || loading) {
    return <main className="p-6">Cargando admin...</main>;
  }

  if (!catalog) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error || "No se pudo cargar el admin."}</p>
          {error.includes("sesión") && (
            <Link href={`/login?next=/${tenantSlug}/admin`} className="mt-2 inline-block text-sm underline">
              Iniciar sesión
            </Link>
          )}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <PanelHeader
        tenantSlug={tenantSlug}
        active={`/${tenantSlug}/admin`}
        title="Administración"
        subtitle="Gestioná equipo, servicios y configuración del local"
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          {error.includes("sesión") && (
            <Link
              href={`/login?next=/${tenantSlug}/admin`}
              className="mt-2 inline-block text-sm font-medium text-red-800 underline"
            >
              Iniciar sesión
            </Link>
          )}
        </Card>
      )}
      {message && (
        <Card className="border-green-200 bg-green-50">
          <p className="text-sm text-green-800">{message}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Profesionales ({catalog.staff.length})</h2>
            <Link href={`/${tenantSlug}/barbero`} className="text-sm text-[var(--brand)] underline">
              Ver panel barbero
            </Link>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {catalog.staff.map((member: StaffItem) => (
              <li key={member.id} className="rounded-xl border border-zinc-200 p-3">
                {editingStaffId === member.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editStaffForm.name}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                    />
                    <Input
                      placeholder="Email"
                      value={editStaffForm.email}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                    />
                    <Input
                      placeholder="Teléfono"
                      value={editStaffForm.phone}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => saveStaffEdit(member.id)} disabled={saving}>
                        Guardar
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingStaffId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-zinc-500">
                          {member.email ?? member.phone ?? "Sin contacto"} · {member.serviceIds.length}{" "}
                          servicios
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" onClick={() => startEditStaff(member)}>
                          Editar
                        </Button>
                        <Button type="button" variant="danger" onClick={() => deleteStaff(member.id, member.name)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form className="mt-4 space-y-3 border-t border-zinc-100 pt-4" onSubmit={createStaff}>
            <h3 className="font-medium">Agregar profesional</h3>
            <div>
              <Label>Nombre</Label>
              <Input
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={saving}>
              Agregar profesional
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Servicios ({catalog.services.length})</h2>
            <Badge tone="brand">Reservas</Badge>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {catalog.services.map((service: ServiceItem) => (
              <li key={service.id} className="rounded-xl border border-zinc-200 p-3">
                {editingServiceId === service.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editServiceForm.name}
                      onChange={(e) => setEditServiceForm({ ...editServiceForm, name: e.target.value })}
                    />
                    <Input
                      type="number"
                      value={editServiceForm.durationMinutes}
                      onChange={(e) =>
                        setEditServiceForm({
                          ...editServiceForm,
                          durationMinutes: Number(e.target.value),
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Precio en pesos"
                      value={editServiceForm.pricePesos}
                      onChange={(e) =>
                        setEditServiceForm({ ...editServiceForm, pricePesos: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => saveServiceEdit(service.id)} disabled={saving}>
                        Guardar
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingServiceId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-zinc-500">
                        {service.durationMinutes} min · {formatMoney(service.priceCents)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" onClick={() => startEditService(service)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => deleteService(service.id, service.name)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="mt-4 space-y-3 border-t border-zinc-100 pt-4" onSubmit={createService}>
            <h3 className="font-medium">Agregar servicio</h3>
            <div>
              <Label>Nombre</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Duración (minutos)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={serviceForm.durationMinutes}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Precio en pesos (opcional)</Label>
              <Input
                type="number"
                min={0}
                value={serviceForm.pricePesos}
                onChange={(e) => setServiceForm({ ...serviceForm, pricePesos: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={saving}>
              Agregar servicio
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
