import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/panel-access";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
}) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--brand)] text-white shadow-sm hover:brightness-110 active:brightness-95",
        variant === "secondary" &&
          "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
        variant === "outline" &&
          "border-2 border-[var(--brand)] bg-transparent text-[var(--brand)] hover:bg-[var(--brand-soft)]",
        variant === "ghost" && "text-zinc-700 hover:bg-zinc-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40",
        className
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-zinc-700", className)} {...props} />;
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "default" && "bg-zinc-100 text-zinc-700",
        tone === "brand" && "bg-[var(--brand-soft)] text-[var(--brand)]",
        tone === "success" && "bg-green-100 text-green-700",
        tone === "warning" && "bg-amber-100 text-amber-800",
        tone === "danger" && "bg-red-100 text-red-700"
      )}
    >
      {children}
    </span>
  );
}

export { PanelNav, PanelHeader } from "@/components/panel-nav";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "confirmed"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "cancelled" || status === "no_show"
          ? "danger"
          : "default";

  return <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-zinc-200", className)} />;
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-11" />
      ))}
    </div>
  );
}

export function StepIndicator({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
        {step}
      </span>
      <span className="font-medium text-zinc-800">{label}</span>
    </div>
  );
}
