import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "fortnai_pb_auth";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && !request.cookies.has(AUTH_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
