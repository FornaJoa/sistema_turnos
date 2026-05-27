import { verifyCredentials } from "@sistema-turnos/api";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");

  const session = await verifyCredentials(email, password);
  if (!session) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  await setSessionCookie(session);

  return NextResponse.json({
    ok: true,
    defaultTenantSlug: session.memberships[0]?.tenantSlug,
    defaultRole: session.memberships[0]?.role,
  });
}
