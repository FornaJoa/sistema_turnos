import { clsx, type ClassValue } from "clsx";
import { formatInTimeZone } from "date-fns-tz";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formato estable SSR/cliente (Intl.currency usa espacios distintos en Node vs browser). */
export function formatMoney(cents: number | null | undefined) {
  if (cents == null) {
    return "-";
  }
  const pesos = Math.round(cents / 100);
  const formatted = Math.abs(pesos)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return pesos < 0 ? `- $ ${formatted}` : `$ ${formatted}`;
}

export function getTodayDateString(timezone: string) {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export function formatTimeOnly(date: Date | string, timezone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

export function formatDateTime(date: Date | string, timezone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(value);
}
