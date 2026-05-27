"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, PanelNav } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

export default function SetupPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const [tenantSlug, setTenantSlug] = useState("");
  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    brandColor: "#4f46e5",
    welcomeTitle: "",
    welcomeSubtitle: "",
    cancellationPolicy: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    params.then((value) => setTenantSlug(value.tenantSlug));
  }, [params]);

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }
    fetchJson<{ tenant: { name: string; settings: any } }>(`/api/tenants/${tenantSlug}/setup`)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setLoading(false);
          return;
        }
        const settings = result.data.tenant.settings;
        setForm({
          name: result.data.tenant.name ?? "",
          logoUrl: settings?.logoUrl ?? "",
          brandColor: settings?.accentColor ?? settings?.primaryColor ?? "#4f46e5",
          welcomeTitle: settings?.welcomeTitle ?? "",
          welcomeSubtitle: settings?.welcomeSubtitle ?? "",
          cancellationPolicy: settings?.cancellationPolicy ?? "",
        });
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar la configuración.");
        setLoading(false);
      });
  }, [tenantSlug]);

  async function saveSetup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const result = await fetchJson(`/api/tenants/${tenantSlug}/setup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Configuración guardada. Los cambios ya están en el sitio público.");
  }

  if (!tenantSlug || loading) {
    return <main className="p-6">Cargando configuración...</main>;
  }

  if (error && !form.name && !form.welcomeTitle) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error}</p>
        </Card>
      </main>
    );
  }

  return (
    <main
      className="mx-auto max-w-3xl space-y-6 p-6"
      style={{ "--brand": form.brandColor, "--brand-soft": `${form.brandColor}20` } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Configuración del local</h1>
          <p className="text-zinc-600">
            Personalización básica: nombre, logo y color de marca. Sin opciones complejas.
          </p>
        </div>
        <PanelNav tenantSlug={tenantSlug} active={`/${tenantSlug}/admin/setup`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <form className="space-y-4" onSubmit={saveSetup}>
            <div>
              <Label>Nombre del local</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Barbería Central"
              />
            </div>
            <div>
              <Label>URL del logo (opcional)</Label>
              <Input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Color de marca</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  className="h-11 w-20 cursor-pointer p-1"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                />
                <span className="text-sm text-zinc-500">Se usa en botones y acentos</span>
              </div>
            </div>
            <div>
              <Label>Título de bienvenida</Label>
              <Input
                value={form.welcomeTitle}
                onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })}
              />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input
                value={form.welcomeSubtitle}
                onChange={(e) => setForm({ ...form, welcomeSubtitle: e.target.value })}
              />
            </div>
            <div>
              <Label>Política de cancelación</Label>
              <Input
                value={form.cancellationPolicy}
                onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-700">{message}</p>}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar configuración"}
              </Button>
              <Link href={`/${tenantSlug}`}>
                <Button type="button" variant="secondary">
                  Ver sitio público
                </Button>
              </Link>
            </div>
          </form>
        </Card>

        <Card className="h-fit">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vista previa</p>
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Logo" className="mb-3 h-10 object-contain" />
            ) : (
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: form.brandColor }}
              >
                {form.name.slice(0, 1) || "B"}
              </div>
            )}
            <p className="text-sm text-zinc-300">{form.name || "Tu local"}</p>
            <h3 className="mt-1 text-lg font-bold">{form.welcomeTitle || "Reservá tu turno online"}</h3>
            <p className="mt-1 text-sm text-zinc-300">
              {form.welcomeSubtitle || "Elegí servicio, profesional y horario."}
            </p>
            <Button className="mt-4 w-full" type="button">
              Reservar ahora
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
