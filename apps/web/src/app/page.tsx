import Link from "next/link";
import { Card } from "@/components/ui";

export default function HomePage() {
  const showPlatformLink = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-3xl font-bold">Sistema de Turnos SaaS</h1>
        <p className="mt-2 text-zinc-600">
          Plataforma multi-local para peluquerías, barberías y centros de estética.
        </p>
        <div
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">Demo pública — no uses datos personales reales</p>
          <p className="mt-1 text-amber-900">
            La demo está conectada a una base de datos en vivo y cualquier persona puede ver o
            usar la información que cargues (nombre, teléfono, email, turnos). Usá datos ficticios.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/barberia-demo"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Ver demo pública
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
          >
            Ingresar
          </Link>
          {showPlatformLink && (
            <Link
              href="/platform"
              className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
            >
              Panel plataforma
            </Link>
          )}
        </div>
      </Card>
    </main>
  );
}
