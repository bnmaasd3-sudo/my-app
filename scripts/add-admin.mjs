#!/usr/bin/env node
// Makes an email the owner of the panel at /ar/admin. If the email has no
// account yet, it is invited and becomes owner at its first sign-in.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-admin.mjs --email owner@example.com [--yes]
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: { email: { type: "string" }, yes: { type: "boolean", default: false } },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: --email <email> [--yes]");
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

async function findUserId() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

const userId = await findUserId();
console.log(`${email} → owner panel (${userId ? "existing account" : "account created at first sign-in"})`);
if (!values.yes) {
  console.log("Dry run. Add --yes to apply.");
  process.exit(0);
}

const { error: inviteError } = await supabase.from("invites").upsert({ email, is_admin: true });
if (inviteError) throw inviteError;
if (userId) {
  const { error } = await supabase.from("admins").upsert({ user_id: userId });
  if (error) throw error;
}
console.log("Done. Sign in at /ar/login with this email, then open /ar/admin.");
