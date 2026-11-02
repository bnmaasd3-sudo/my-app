"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { DEVICE_COOKIE } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import {
  isValidCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
} from "@/lib/validation";

export type LoginError = "invalidEmail" | "invalidCode" | "rateLimited" | "generic";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: LoginError;
};

type AuthError = { status?: number; code?: string };

const isRateLimited = (error: AuthError) =>
  error.status === 429 || Boolean(error.code?.startsWith("over_"));

// Supabase answers these when the email has no account. They are reported
// like a sent code so the form does not reveal who has an account.
const isUnknownAccount = (error: AuthError) =>
  error.code === "otp_disabled" ||
  error.code === "signup_disabled" ||
  error.code === "user_not_found" ||
  error.status === 422;

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error && isRateLimited(error)) return { step: "email", email, error: "rateLimited" };
    if (error && !isUnknownAccount(error)) return { step: "email", email, error: "generic" };
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

const FONT_SIZES = ["sm", "md", "lg"];
const THEMES = ["system", "light", "dark"];

export async function savePrefs(fontSize: string, theme: string) {
  if (!FONT_SIZES.includes(fontSize) || !THEMES.includes(theme)) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const readerId = data?.claims?.sub;
  if (!readerId) return;
  await supabase.from("reader_prefs").upsert({
    reader_id: readerId,
    font_size: fontSize,
    theme,
    updated_at: new Date().toISOString(),
  });
}
