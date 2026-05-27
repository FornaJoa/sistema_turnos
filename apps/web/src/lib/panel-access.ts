import type { MembershipRole } from "@sistema-turnos/api";

export function getDefaultPanelPath(tenantSlug: string, role: MembershipRole): string {
  switch (role) {
    case "staff":
      return `/${tenantSlug}/barbero`;
    case "reception":
      return `/${tenantSlug}/reception`;
    case "owner":
      return `/${tenantSlug}/owner`;
    default:
      return `/${tenantSlug}/admin`;
  }
}

export function getPanelLinksForRole(
  tenantSlug: string,
  role: MembershipRole | null | undefined
) {
  const publicLink = { href: `/${tenantSlug}`, label: "Sitio público" };

  if (!role) {
    return [publicLink];
  }

  const links: Array<{ href: string; label: string }> = [publicLink];

  if (role === "staff") {
    links.push({ href: `/${tenantSlug}/barbero`, label: "Mi agenda" });
    return links;
  }

  if (role === "reception") {
    links.push({ href: `/${tenantSlug}/reception`, label: "Recepción" });
    return links;
  }

  if (role === "admin") {
    links.push(
      { href: `/${tenantSlug}/reception`, label: "Recepción" },
      { href: `/${tenantSlug}/admin`, label: "Admin" }
    );
    return links;
  }

  if (role === "owner") {
    links.push(
      { href: `/${tenantSlug}/reception`, label: "Recepción" },
      { href: `/${tenantSlug}/admin`, label: "Admin" },
      { href: `/${tenantSlug}/admin/setup`, label: "Configuración" },
      { href: `/${tenantSlug}/owner`, label: "Estadísticas" }
    );
  }

  return links;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
  no_show: "No asistió",
};
