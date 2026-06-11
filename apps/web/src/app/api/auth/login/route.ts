import { verifyCredentials, rateLimit, loginBodySchema } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = await rateLimit(`login:${ip}`, 10, 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Esperá un minuto e intentá de nuevo." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido en la solicitud." }, { status: 400 });
    }

    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos inválidos." },
        { status: 400 }
      );
    }

    const session = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!session) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    await setSessionCookie(session);

    return NextResponse.json({
      ok: true,
      defaultTenantSlug: session.memberships[0]?.tenantSlug,
      defaultRole: session.memberships[0]?.role,
    });
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      { error: "Error del servidor. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
