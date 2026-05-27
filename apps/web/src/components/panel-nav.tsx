"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MembershipRole } from "@sistema-turnos/api";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { getPanelLinksForRole } from "@/lib/panel-access";

export function PanelNav({
  tenantSlug,
  active,
}: {
  tenantSlug: string;
  active: string;
}) {
  const [role, setRole] = useState<MembershipRole | null>(null);

  useEffect(() => {
    fetchJson<{ membership?: { role: MembershipRole } }>(`/api/tenants/${tenantSlug}/me`).then(
      (result) => {
        setRole(result.ok ? result.data.membership?.role ?? null : null);
      }
    );
  }, [tenantSlug]);

  const links = getPanelLinksForRole(tenantSlug, role);

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            active === link.href
              ? "bg-[var(--brand)] text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function PanelHeader({
  title,
  subtitle,
  tenantSlug,
  active,
  actions,
}: {
  title: string;
  subtitle?: string;
  tenantSlug: string;
  active: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-1 text-zinc-600">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <PanelNav tenantSlug={tenantSlug} active={active} />
    </div>
  );
}
