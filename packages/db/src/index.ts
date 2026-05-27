import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

function resolveConnectionString() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL no está configurada en el Worker. Agregala en Cloudflare → Settings → Variables and Secrets."
    );
  }

  return "postgresql://turnos:turnos_dev@localhost:5432/sistema_turnos";
}

function shouldUseNeonHttp(connectionString: string) {
  return (
    process.env.DB_DRIVER === "neon-http" ||
    connectionString.includes("neon.tech")
  );
}

const connectionString = resolveConnectionString();

// Cloudflare Workers: TCP (postgres.js) puede colgar. Neon HTTP usa fetch y funciona en edge.
export const db = shouldUseNeonHttp(connectionString)
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzlePostgres(
      postgres(connectionString, {
        max: Number(process.env.DB_POOL_MAX ?? 3),
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      }),
      { schema }
    );

export * from "./schema/index";
