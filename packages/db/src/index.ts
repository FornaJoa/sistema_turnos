import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://turnos:turnos_dev@localhost:5432/sistema_turnos";

// Serverless (Neon/Vercel): 1 conexión por instancia evita agotar el pool de Neon.
// Docker/local: podés subir DB_POOL_MAX en .env.
const poolMax = Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 1 : 3));

const client = postgres(connectionString, {
  max: poolMax,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
export * from "./schema/index";
