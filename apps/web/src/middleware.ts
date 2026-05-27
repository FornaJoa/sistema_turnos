import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "st_session";

const PANEL_PATH =
  /^\/[^/]+\/(reception|admin|owner|barbero)(\/|$)/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (!PANEL_PATH.test(pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform", "/platform/:path*", "/:slug/reception", "/:slug/reception/:path*", "/:slug/admin", "/:slug/admin/:path*", "/:slug/owner", "/:slug/owner/:path*", "/:slug/barbero", "/:slug/barbero/:path*"],
};
