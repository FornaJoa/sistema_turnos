import Link from "next/link";
import { PublicBookingFlow } from "@/components/public-booking-flow";
import { Badge } from "@/components/ui";
import { getCachedTenantCatalog } from "@/lib/catalog";
import { applyTenantTheme } from "@/lib/tenant-theme";
import { formatMoney, getTodayDateString } from "@/lib/utils";

export default async function TenantPublicPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const initialCatalog = await getCachedTenantCatalog(tenantSlug);
  const settings = initialCatalog.tenant.settings!;
  const themeStyle = applyTenantTheme(settings);
  const initialDate = getTodayDateString(initialCatalog.tenant.timezone);

  return (
    <main className="min-h-screen bg-[var(--background)]" style={themeStyle}>
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt={initialCatalog.tenant.name}
                  className="mb-4 h-12 object-contain"
                />
              ) : (
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  {initialCatalog.tenant.name.slice(0, 1)}
                </div>
              )}
              <Badge tone="brand">{initialCatalog.tenant.name}</Badge>
              <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                {settings.welcomeTitle}
              </h1>
              <p className="mt-3 text-lg text-zinc-300">{settings.welcomeSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-300">
                <span className="rounded-full bg-white/10 px-3 py-1">
                  {initialCatalog.services.length} servicios
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1">
                  {initialCatalog.staff.length} profesionales
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1">Reserva en minutos</span>
              </div>
            </div>
            <Link
              href="/login"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              Acceso staff
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {initialCatalog.services.slice(0, 3).map((service) => (
            <div
              key={service.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="font-semibold text-zinc-900">{service.name}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {service.durationMinutes} min · {formatMoney(service.priceCents)}
              </p>
            </div>
          ))}
        </div>

        <PublicBookingFlow
          tenantSlug={tenantSlug}
          initialCatalog={initialCatalog}
          initialDate={initialDate}
        />

        <p className="mt-8 text-center text-sm text-zinc-500">{settings.cancellationPolicy}</p>
      </section>
    </main>
  );
}
