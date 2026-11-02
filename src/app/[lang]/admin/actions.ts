"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type AddReaderState = {
  status: "idle" | "linked" | "invited" | "error";
  error?: "invalidEmail" | "noBook" | "generic";
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
  return { status: data === "linked" ? "linked" : "invited" };
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
