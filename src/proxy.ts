import { NextResponse, type NextRequest } from "next/server";
import { locales } from "@/i18n/config";
import { negotiateLocale } from "@/i18n/negotiate";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocalePrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocalePrefix) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next.js internals, API routes and files with an extension
  // (icons, manifest, robots.txt, ...).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
