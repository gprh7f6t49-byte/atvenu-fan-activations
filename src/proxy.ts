import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only — every admin page and route verifies the signed session itself.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("fa_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login|accept|forgot).*)"],
};
