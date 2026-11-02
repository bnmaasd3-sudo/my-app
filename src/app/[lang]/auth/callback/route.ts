import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

const LINK_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite"];

// Where the sign-in link in the email lands. Supabase sends either a PKCE
// `code` (default template) or a `token_hash` (custom template); both become
// a session cookie, then the reader goes to their library. Redirects only
// ever go to this site's own paths.
export async function GET(request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang: requested } = await params;
  const lang = hasLocale(requested) ? requested : "ar";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && LINK_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = ok ? `/${lang}/library` : `/${lang}/login?error=link`;
  return NextResponse.redirect(new URL(target, url.origin));
}
