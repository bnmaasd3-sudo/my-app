"use server";

import { createClient } from "@/lib/supabase/server";

// Storage for the type test. The test keeps documents by path, the way its
// own page did ("results/<key>", "settings/path"); these actions map them to
// public.test_results and public.test_settings. Row-level security decides
// who may read or write what (see supabase/migrations/20261103000000_type_test.sql).

type Doc = Record<string, unknown>;
export type DocResult = { ok: true; exists: boolean; data: Doc | null } | { ok: false; code: string };
export type SaveResult = { ok: true } | { ok: false; code: string };
export type ListResult = { ok: true; rows: { key: string; answers: Doc }[] } | { ok: false; code: string };

const RESULT_PATH = /^results\/([A-Za-z0-9_-]{1,200})$/;
const SETTINGS_PATH = "settings/path";
const PATHS = ["classic", "branch", "typed"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// An attempt is a few kilobytes; this leaves room and stops abuse.
const MAX_JSON = 1_000_000;

const isDoc = (value: unknown): value is Doc =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// "not_granted" makes the test stop writing and show the result code to copy instead.
const denied = (error: { code?: string } | null) =>
  ({ ok: false, code: error?.code === "42501" ? "not_granted" : "failed" }) as const;

/** The account a result key belongs to: the reader's own id, or the id of an archived attempt. */
function ownerOfKey(key: string) {
  const base = key.split("__old_")[0];
  return UUID.test(base) ? base : null;
}

export async function getTestDoc(path: string): Promise<DocResult> {
  const supabase = await createClient();
  if (path === SETTINGS_PATH) {
    const { data, error } = await supabase.from("test_settings").select("path").maybeSingle();
    if (error) return denied(error);
    return { ok: true, exists: Boolean(data), data: data ? { path: data.path } : null };
  }
  const match = RESULT_PATH.exec(String(path));
  if (!match) return { ok: false, code: "invalid_argument" };
  const { data, error } = await supabase
    .from("test_results")
    .select("answers")
    .eq("key", match[1])
    .maybeSingle();
  if (error) return denied(error);
  return { ok: true, exists: Boolean(data), data: data ? (data.answers as Doc) : null };
}

export async function setTestDoc(path: string, value: unknown, summary: unknown): Promise<SaveResult> {
  if (!isDoc(value) || JSON.stringify(value).length > MAX_JSON) return { ok: false, code: "invalid_argument" };
  const supabase = await createClient();

  if (path === SETTINGS_PATH) {
    if (!PATHS.includes(String(value.path))) return { ok: false, code: "invalid_argument" };
    const { error } = await supabase
      .from("test_settings")
      .upsert({ id: true, path: String(value.path), updated_at: new Date().toISOString() });
    return error ? denied(error) : { ok: true };
  }

  const match = RESULT_PATH.exec(String(path));
  if (!match) return { ok: false, code: "invalid_argument" };
  const key = match[1];
  const result = isDoc(summary) && JSON.stringify(summary).length < 2_000 ? summary : null;
  const { error } = await supabase
    .from("test_results")
    .upsert({ key, user_id: ownerOfKey(key), answers: value, result }, { onConflict: "key" });
  return error ? denied(error) : { ok: true };
}

/** Every attempt, for the owner's results list. Others get only their own row back. */
export async function listTestResults(): Promise<ListResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_results")
    .select("key, answers")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) return denied(error);
  return { ok: true, rows: (data ?? []) as { key: string; answers: Doc }[] };
}
