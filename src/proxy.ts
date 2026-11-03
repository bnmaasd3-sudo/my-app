import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, locales } from "@/i18n/config";
import { negotiateLocale } from "@/i18n/negotiate";
import { DEVICE_COOKIE, deviceCookieOptions } from "@/lib/device";
import { readSupabaseEnv } from "@/lib/supabase/env";

const LOCALE = `(${locales.join("|")})`;
const SESSION_ROUTES = new RegExp(`^/${LOCALE}/(login|library|read|admin|test)(/|$)`);
const PROTECTED_ROUTES = new RegExp(`^/${LOCALE}/(library|read|admin|test)(/|$)`);
const LOGIN_ROUTE = new RegExp(`^/${LOCALE}/login/?$`);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname.split("/")[1];

  if (!hasLocale(locale)) {
    const preferred = negotiateLocale(request.headers.get("accept-language"));
    request.nextUrl.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  if (!SESSION_ROUTES.test(pathname)) return;

  // Give every browser a device id before it reaches a reading page.
  const newDeviceId = request.cookies.has(DEVICE_COOKIE) ? null : crypto.randomUUID();
  if (newDeviceId) request.cookies.set(DEVICE_COOKIE, newDeviceId);

  let response = NextResponse.next({ request });
  let signedIn = false;

  const env = readSupabaseEnv();
  if (env) {
    // Refreshes the session cookies so Server Components see a valid token.
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  // Optimistic redirects only; every page and database call checks again.
  let target: string | null = null;
  if (!signedIn && PROTECTED_ROUTES.test(pathname)) target = `/${locale}/login`;
  if (signedIn && LOGIN_ROUTE.test(pathname)) target = `/${locale}/library`;
  if (target) {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    response = redirect;
  }

  if (newDeviceId) response.cookies.set(DEVICE_COOKIE, newDeviceId, deviceCookieOptions);
  return response;
}

export const config = {
  // Skip Next.js internals, API routes and files with an extension
  // (icons, manifest, robots.txt, ...).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
