"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

const isDev = process.env.NODE_ENV === "development";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(isDev ? "owner@demo.com" : "");
  const [password, setPassword] = useState(isDev ? "password123" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      setError("Error del servidor. Reintentá en unos segundos.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Error de autenticación");
      return;
    }

    const next = searchParams.get("next");
    if (next) {
      router.push(next);
      return;
    }

    if (data.defaultTenantSlug) {
      const role = data.defaultRole;
      const slug = data.defaultTenantSlug;
      if (role === "staff") {
        router.push(`/${slug}/barbero`);
        return;
      }
      if (role === "reception") {
        router.push(`/${slug}/reception`);
        return;
      }
      if (role === "owner") {
        router.push(`/${slug}/owner`);
        return;
      }
      router.push(`/${slug}/admin`);
      return;
    }

    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full">
        <h1 className="text-2xl font-bold">Ingresar</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
          {isDev && (
            <p className="text-center text-xs text-zinc-500">
              Demo local: owner@demo.com / password123
            </p>
          )}
        </form>
      </Card>
    </main>
  );
}
