import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNeonServerless } from "drizzle-orm/neon-serverless";
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

function shouldUseNeon(connectionString: string) {
  return process.env.DB_DRIVER === "neon" || connectionString.includes("neon.tech");
}

const connectionString = resolveConnectionString();
const useNeon = shouldUseNeon(connectionString);

function createDb() {
  if (useNeon) {
    // HTTP: lecturas y writes simples (sin transacción). Estable en Cloudflare Workers.
    const sql = neon(connectionString);
    return drizzleNeonHttp(sql, { schema });
  }

  return drizzlePostgres(
    postgres(connectionString, {
      max: Number(process.env.DB_POOL_MAX ?? 3),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    }),
    { schema }
  );
}

export const db = createDb();

/** Transacciones con pool WebSocket efímero (requerido en Workers; no reutilizar pool global). */
export async function withDbTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  if (!useNeon) {
    return db.transaction(fn);
  }

  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString });

  try {
    const txDb = drizzleNeonServerless(pool, { schema });
    return await txDb.transaction(fn);
  } finally {
    await pool.end();
  }
}

export * from "./schema/index";
