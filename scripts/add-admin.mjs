#!/usr/bin/env node
// Makes an email the owner of the panel at /ar/admin. Creates the sign-in
// account if it does not exist. Run once by the project owner.
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

let userId = await findUserId();
console.log(`${userId ? "Existing" : "New"} account ${email} → owner panel`);
if (!values.yes) {
  console.log("Dry run. Add --yes to apply.");
  process.exit(0);
}

if (userId) {
  // Someone may have signed up with this email and a password first. Readers
  // only use email codes, so replace any password with a random one.
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (error) throw error;
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
}

const { error } = await supabase.from("admins").upsert({ user_id: userId });
if (error) throw error;
console.log("Done. Sign in at /ar/login with this email, then open /ar/admin.");
