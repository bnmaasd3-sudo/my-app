#!/usr/bin/env node
// Adds (or re-activates) a reader and gives them a book. Used by /add-reader
// for gifts and testers; Salla purchases will do the same automatically.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/add-reader.mjs --email reader@example.com --book infj-t-h-reader [--name "Noura"] [--yes]
//
// Without --yes it only shows what it would do. Never deletes anything.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    book: { type: "string" },
    name: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !values.book) {
  console.error('Usage: --email <email> --book <slug> [--name "<display name>"] [--yes]');
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never in a file in the repo).");
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: book, error: bookError } = await supabase
  .from("books")
  .select("id, slug, title")
  .eq("slug", values.book)
  .maybeSingle();
if (bookError) throw bookError;
if (!book) {
  const { data: books } = await supabase.from("books").select("slug, title");
  console.error(`No book "${values.book}". Available: ${books?.map((b) => b.slug).join(", ") || "none"}`);
  process.exit(1);
}

async function findUserId() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

const existingId = await findUserId();
console.log(
  `${existingId ? "Existing" : "New"} reader ${email}${values.name ? ` (${values.name})` : ""} → "${book.title}" (${book.slug})`,
);
if (!values.yes) {
  console.log("Dry run. Add --yes to apply.");
  process.exit(0);
}

const { error: inviteError } = await supabase
  .from("invites")
  .upsert({ email, ...(values.name ? { display_name: values.name } : {}) });
if (inviteError) throw inviteError;

if (!existingId) {
  // No account yet: the book opens at the first sign-in (see apply_invite).
  const { error } = await supabase
    .from("pending_entitlements")
    .upsert({ email, book_id: book.id, source: "manual" });
  if (error) throw error;
  console.log("Invited. The book opens when they first sign in with this email and the code it receives.");
  process.exit(0);
}

const userId = existingId;
const reader = { id: userId, email, active: true };
if (values.name) reader.display_name = values.name;
const { error: readerError } = await supabase.from("readers").upsert(reader);
if (readerError) throw readerError;

// Re-activating keeps the entitlement's original source (e.g. a Salla purchase).
const { data: existing, error: lookupError } = await supabase
  .from("entitlements")
  .select("source")
  .eq("reader_id", userId)
  .eq("book_id", book.id)
  .maybeSingle();
if (lookupError) throw lookupError;

const { error: entitlementError } = existing
  ? await supabase
      .from("entitlements")
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq("reader_id", userId)
      .eq("book_id", book.id)
  : await supabase
      .from("entitlements")
      .insert({ reader_id: userId, book_id: book.id, active: true, source: "manual" });
if (entitlementError) throw entitlementError;

console.log("Done. The reader signs in with this email and the code it receives.");
