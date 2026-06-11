"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";

type ProfileForm = {
  bio: string;
  avatarUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
};

export function StaffProfileEditor({
  tenantSlug,
  staffId,
  canEdit = true,
}: {
  tenantSlug: string;
  staffId: string;
  canEdit?: boolean;
}) {
  const [form, setForm] = useState<ProfileForm>({
    bio: "",
    avatarUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tenantSlug || !staffId) {
      return;
    }

    setLoading(true);
    fetchJson<{ profile: ProfileForm }>(
      `/api/tenants/${tenantSlug}/staff/${staffId}/profile`
    ).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setForm({
        bio: result.data.profile.bio ?? "",
        avatarUrl: result.data.profile.avatarUrl ?? "",
        instagramUrl: result.data.profile.instagramUrl ?? "",
        tiktokUrl: result.data.profile.tiktokUrl ?? "",
      });
      setError("");
      setLoading(false);
    });
  }, [tenantSlug, staffId]);

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");

    const result = await fetchJson(`/api/tenants/${tenantSlug}/staff/${staffId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Perfil público actualizado.");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando perfil...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Esto es lo que ven los clientes al elegir profesional. No se muestra tu teléfono interno.
      </p>
      <div className="flex items-center gap-4">
        {form.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.avatarUrl}
            alt="Vista previa"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-zinc-200"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-sm text-zinc-500">
            Sin foto
          </div>
        )}
        <div className="flex-1">
          <Label>Foto (URL pública)</Label>
          <Input
            placeholder="https://..."
            value={form.avatarUrl}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Bio / presentación</Label>
        <Input
          value={form.bio}
          disabled={!canEdit}
          placeholder="Especialista en fades y barba clásica"
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
        />
      </div>
      <div>
        <Label>Instagram (@usuario o link)</Label>
        <Input
          value={form.instagramUrl}
          disabled={!canEdit}
          placeholder="@juanbarbero"
          onChange={(event) => setForm({ ...form, instagramUrl: event.target.value })}
        />
      </div>
      <div>
        <Label>TikTok (@usuario o link)</Label>
        <Input
          value={form.tiktokUrl}
          disabled={!canEdit}
          placeholder="@juanbarbero"
          onChange={(event) => setForm({ ...form, tiktokUrl: event.target.value })}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {canEdit && (
        <Button type="button" onClick={saveProfile} disabled={saving}>
          {saving ? "Guardando..." : "Guardar perfil público"}
        </Button>
      )}
    </div>
  );
}
