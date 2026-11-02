"use server";

import { refresh } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type AddReaderState = {
  status: "idle" | "added" | "error";
  error?: "invalidEmail" | "noBook" | "noServiceKey" | "generic";
};

// Every function below is also checked by the database (assert_admin), so a
// non-owner calling these actions directly gets nothing.
async function ownerClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin === true ? supabase : null;
}

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

async function findOrCreateAccount(service: ServiceClient, email: string) {
  const created = await service.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      // Someone may have signed up with this email and a password before the
      // buyer did. Readers only use email codes, so replace any password with
      // a random one before the account is given a book.
      const reset = await service.auth.admin.updateUserById(user.id, {
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
      });
      if (reset.error) throw reset.error;
      return user.id;
    }
    if (data.users.length < 1000) break;
  }
  throw created.error ?? new Error("Could not create the sign-in account");
}

export async function addReader(_previous: AddReaderState, formData: FormData): Promise<AddReaderState> {
  const supabase = await ownerClient();
  if (!supabase) return { status: "error", error: "generic" };

  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const book = String(formData.get("book") ?? "");
  if (!isValidEmail(email)) return { status: "error", error: "invalidEmail" };
  if (!book) return { status: "error", error: "noBook" };

  const service = createServiceClient();
  if (!service) return { status: "error", error: "noServiceKey" };

  try {
    const userId = await findOrCreateAccount(service, email);
    const registered = await supabase.rpc("admin_register_reader", {
      p_user_id: userId,
      p_email: email,
      p_display_name: name,
    });
    if (registered.error) throw registered.error;
    const linked = await supabase.rpc("admin_set_entitlement", {
      p_reader_id: userId,
      p_book_slug: book,
      p_active: true,
    });
    if (linked.error) throw linked.error;
  } catch {
    return { status: "error", error: "generic" };
  }

  refresh();
  return { status: "added" };
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

export async function revokeDevice(readerId: string, deviceId: string) {
  const supabase = await ownerClient();
  if (!supabase) return;
  await supabase.rpc("admin_revoke_device", { p_reader_id: readerId, p_device_id: deviceId });
  refresh();
}
