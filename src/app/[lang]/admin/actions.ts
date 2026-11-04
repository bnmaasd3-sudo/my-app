"use server";

import { refresh } from "next/cache";
import { dir, hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { sendMail, welcomeMail, type MailResult } from "@/lib/mail";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type AddReaderState = {
  status: "idle" | "linked" | "invited" | "error";
  error?: "invalidEmail" | "noBook" | "generic";
  /** Whether the welcome email went out (or email is not set up). */
  mail?: MailResult;
};

export type ResendState = { status: "idle" | MailResult | "error" };

/** The welcome email, in the language the owner is using the panel in. Never throws. */
async function sendWelcome(email: string, name: string | null, lang: Locale): Promise<MailResult> {
  try {
    return await composeAndSend(email, name, lang);
  } catch {
    return "failed";
  }
}

async function composeAndSend(email: string, name: string | null, lang: Locale): Promise<MailResult> {
  const dict = await getDictionary(lang);
  return sendMail(
    welcomeMail({
      to: email,
      name,
      loginUrl: `${await siteOrigin()}/${lang}/login`,
      appName: dict.app.name,
      dir: dir(lang),
      text: dict.email.welcome,
    }),
  );
}

const localeOf = (formData: FormData): Locale => {
  const lang = String(formData.get("lang") ?? "");
  return hasLocale(lang) ? lang : "ar";
};

// Every function below is also checked by the database (assert_admin), so a
// non-owner calling these actions directly gets nothing.
async function ownerClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin === true ? supabase : null;
}

export async function addReader(_previous: AddReaderState, formData: FormData): Promise<AddReaderState> {
  const supabase = await ownerClient();
  if (!supabase) return { status: "error", error: "generic" };

  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const book = String(formData.get("book") ?? "");
  if (!isValidEmail(email)) return { status: "error", error: "invalidEmail" };
  if (!book) return { status: "error", error: "noBook" };

  const { data, error } = await supabase.rpc("admin_add_reader", {
    p_email: email,
    p_display_name: name,
    p_book_slug: book,
  });
  if (error) return { status: "error", error: "generic" };

  refresh();
  if (data === "linked") return { status: "linked" };
  // A new invitation: tell them the book is there and how to sign in. Someone
  // who already has an account just finds the book in their library.
  const mail = await sendWelcome(email, name || null, localeOf(formData));
  return { status: "invited", mail };
}

/** Sends the welcome again to a reader or an invited email. Owner only. */
export async function resendWelcome(_previous: ResendState, formData: FormData): Promise<ResendState> {
  const supabase = await ownerClient();
  if (!supabase) return { status: "error" };
  const email = normalizeEmail(formData.get("email"));
  if (!isValidEmail(email)) return { status: "error" };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || null;
  return { status: await sendWelcome(email, name, localeOf(formData)) };
}

export async function setReaderActive(readerId: string, active: boolean) {
  const supabase = await ownerClient();
  if (!supabase) return;
  await supabase.rpc("admin_set_reader_active", { p_reader_id: readerId, p_active: active });
  refresh();
}

export async function setEntitlement(readerId: string, bookSlug: string, active: boolean) {
  const supabase = await ownerClient();
  if (!supabase) return;
  await supabase.rpc("admin_set_entitlement", {
    p_reader_id: readerId,
    p_book_slug: bookSlug,
    p_active: active,
  });
  refresh();
}

export async function setSallaProduct(formData: FormData) {
  const supabase = await ownerClient();
  if (!supabase) return;
  const sku = String(formData.get("sku") ?? "").trim().slice(0, 120);
  const book = String(formData.get("book") ?? "");
  if (!sku || !book) return;
  await supabase.rpc("admin_set_salla_product", { p_sku: sku, p_book_slug: book });
  refresh();
}

export async function revokeDevice(readerId: string, deviceId: string) {
  const supabase = await ownerClient();
  if (!supabase) return;
  await supabase.rpc("admin_revoke_device", { p_reader_id: readerId, p_device_id: deviceId });
  refresh();
}
