import { sql } from "drizzle-orm";
import { db } from "@sistema-turnos/db";
import { NextResponse } from "next/server";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET?.trim());
  const hasUpstash =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

  try {
    await db.execute(sql`select 1 as ok`);
    return NextResponse.json({
      ok: true,
      database: "connected",
      env: { hasDatabaseUrl, hasAuthSecret, hasUpstash },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        message,
        env: { hasDatabaseUrl, hasAuthSecret, hasUpstash },
      },
      { status: 500 }
    );
  }
}
