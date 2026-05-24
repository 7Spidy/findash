import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/data")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  const hasAuth = token === "findash_authenticated";

  // In development with no password set, allow through
  const passwordRequired = !!process.env.DASHBOARD_PASSWORD;
  if (!passwordRequired) return NextResponse.next();

  if (!hasAuth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
