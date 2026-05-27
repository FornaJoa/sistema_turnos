import { db } from "@sistema-turnos/db";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/tenant-auth";

export default async function PlatformPage() {
  await requirePlatformAdmin();

  const allTenants = await db.query.tenants.findMany({
    with: { settings: true },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <h1 className="text-3xl font-bold">Panel plataforma</h1>
        <p className="mt-2 text-zinc-600">Super-administración del SaaS multi-local</p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Locales registrados</h2>
        <div className="mt-4 space-y-3">
          {allTenants.map((tenant) => (
            <div key={tenant.id} className="rounded-xl border border-zinc-200 p-4">
              <p className="font-medium">{tenant.name}</p>
              <p className="text-sm text-zinc-600">/{tenant.slug}</p>
              <a className="text-sm text-blue-600 underline" href={`/${tenant.slug}`}>
                Abrir sitio público
              </a>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
