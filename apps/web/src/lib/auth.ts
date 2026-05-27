import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AuthSession } from "@sistema-turnos/api";

const SESSION_COOKIE = "st_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.includes("change-me")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET debe estar configurado en producción.");
    }
    return new TextEncoder().encode("dev-secret-local-only");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AuthSession): Promise<string> {
  return new SignJWT({ session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.session as AuthSession;
  } catch {
    await clearSessionCookie();
    return null;
  }
}

export async function setSessionCookie(session: AuthSession) {
  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
