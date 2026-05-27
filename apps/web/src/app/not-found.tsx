import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-zinc-900">Página no encontrada</h1>
      <p className="mt-3 max-w-md text-zinc-600">
        El local que buscás no existe o el enlace es incorrecto.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
