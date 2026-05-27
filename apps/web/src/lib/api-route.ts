import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown, tag: string) {
  console.error(`[${tag}]`, error);
  return jsonError("Error del servidor. Reintentá en unos segundos.", 500);
}
