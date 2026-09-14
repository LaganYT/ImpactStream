import { NextRequest, NextResponse } from "next/server";

const VIDFAST_PROXY_PREFIX = "/api/vidfast-proxy";
const VIDFAST_RUNTIME_PREFIX = "/1bd47015-5df0-535b-8e48-527c6d85c833";
const VIDFAST_ROOT_PATHS = new Set(["/wyzie", "/4k.png", "/globe.png"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith(VIDFAST_RUNTIME_PREFIX) ||
    VIDFAST_ROOT_PATHS.has(pathname)
  ) {
    const target = request.nextUrl.clone();
    target.pathname = `${VIDFAST_PROXY_PREFIX}${pathname}`;
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/1bd47015-5df0-535b-8e48-527c6d85c833/:path*",
    "/wyzie",
    "/4k.png",
    "/globe.png",
  ],
};
