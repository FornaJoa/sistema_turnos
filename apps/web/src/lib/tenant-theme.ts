export function applyTenantTheme(settings: {
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
}) {
  const brand = settings.accentColor || settings.primaryColor || "#4f46e5";

  return {
    "--brand": brand,
    "--brand-soft": `${brand}20`,
    "--font-family":
      settings.fontFamily === "georgia"
        ? "Georgia, serif"
        : settings.fontFamily === "mono"
          ? "ui-monospace, monospace"
          : "Inter, system-ui, sans-serif",
  } as React.CSSProperties;
}
