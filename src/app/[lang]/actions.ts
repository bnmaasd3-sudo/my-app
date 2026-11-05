"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { DEVICE_COOKIE } from "@/lib/device";
import { isFontSize, isLayout, isTheme, isWidth } from "@/lib/reader-prefs";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  isValidCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
} from "@/lib/validation";

export type LoginError = "invalidEmail" | "invalidCode" | "rateLimited" | "link" | "generic";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: LoginError;
};

type AuthError = { status?: number; code?: string };

const isRateLimited = (error: AuthError) =>
  error.status === 429 || Boolean(error.code?.startsWith("over_"));

// An email nobody invited is refused by the database (guard_new_user), and
// Supabase answers with an error. It is reported like a sent code so the form
// does not reveal who has an account. Only a network failure has no status.
const isRefusedEmail = (error: AuthError) => typeof error.status === "number" && error.status >= 400;

const safeLocale = (lang: string) => (hasLocale(lang) ? lang : "ar");

export async function login(
  lang: string,
  previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = formData.get("intent");
  if (intent === "reset") return { step: "email", email: previous.email };

  const email = normalizeEmail(formData.get("email"));
  if (!isValidEmail(email)) return { step: "email", email, error: "invalidEmail" };

  const supabase = await createClient();

  if (intent === "send") {
    // Invited emails get their account on first sign-in; see guard_new_user.
    // The email carries a link back to /auth/callback (and a code when the
    // project's email template includes {{ .Token }}).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${await siteOrigin()}/${safeLocale(lang)}/auth/callback` },
    });
    if (error && isRateLimited(error)) return { step: "email", email, error: "rateLimited" };
    if (error && !isRefusedEmail(error)) return { step: "email", email, error: "generic" };
    return { step: "code", email };
  }

  const token = normalizeCode(formData.get("code"));
  if (!isValidCode(token)) return { step: "code", email, error: "invalidCode" };

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { step: "code", email, error: isRateLimited(error) ? "rateLimited" : "invalidCode" };
  }
  redirect(`/${safeLocale(lang)}/library`);
}

export async function signOut(lang: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${safeLocale(lang)}`);
}

export async function saveProgress(bookSlug: string, position: number, scrollRatio: number) {
  if (
    typeof bookSlug !== "string" ||
    !Number.isInteger(position) ||
    !Number.isFinite(scrollRatio)
  ) {
    return;
  }
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  const supabase = await createClient();
  await supabase.rpc("save_progress", {
    p_book_slug: bookSlug,
    p_position: position,
    p_scroll_ratio: Math.min(Math.max(scrollRatio, 0), 1),
    p_device_id: deviceId,
  });
}

/**
 * Saves the reader's display choices. Sepia and the line width need migration
 * 20261105070000; until it is applied the row keeps the rest (sepia stored as
 * light) and the reading screen keeps sepia and the width on the device.
 */
export async function savePrefs(fontSize: string, theme: string, layout: string, width: string = "md") {
  if (!isFontSize(fontSize) || !isTheme(theme) || !isLayout(layout) || !isWidth(width)) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const readerId = data?.claims?.sub;
  if (!readerId) return;
  const row = { reader_id: readerId, font_size: fontSize, theme, layout, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("reader_prefs").upsert({ ...row, width });
  if (error) {
    await supabase.from("reader_prefs").upsert({ ...row, theme: theme === "sepia" ? "light" : theme });
  }
}
