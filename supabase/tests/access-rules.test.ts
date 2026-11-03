// Runs every migration against an in-memory Postgres (PGlite) with stand-ins
// for Supabase's roles and auth.uid(), then checks who can read what.
// These are the fixed access tests from CLAUDE.md: never skip or weaken them.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");

const SUPABASE_STANDINS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text default '');
  create schema storage;
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants every new public table and function to these roles.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const INFJ_READER = "00000000-0000-4000-8000-000000000001";
const ESFJ_READER = "00000000-0000-4000-8000-000000000002";
const INACTIVE_READER = "00000000-0000-4000-8000-000000000003";
const REFUNDED_READER = "00000000-0000-4000-8000-000000000004";
const OWNER = "00000000-0000-4000-8000-0000000000aa";
const NEW_USER = "00000000-0000-4000-8000-0000000000bb";

const SEED = `
  insert into auth.users (id, email) values
    ('${INFJ_READER}', 'infj@example.com'),
    ('${ESFJ_READER}', 'esfj@example.com'),
    ('${INACTIVE_READER}', 'off@example.com'),
    ('${REFUNDED_READER}', 'refund@example.com'),
    ('${OWNER}', 'owner@example.com'),
    ('${NEW_USER}', 'new@example.com');
  insert into public.admins (user_id) values ('${OWNER}');
  insert into public.readers (id, email, display_name, active) values
    ('${INFJ_READER}', 'infj@example.com', 'Noura', true),
    ('${ESFJ_READER}', 'esfj@example.com', null, true),
    ('${INACTIVE_READER}', 'off@example.com', null, false),
    ('${REFUNDED_READER}', 'refund@example.com', null, true);
  insert into public.books (slug, title, lang) values
    ('infj-t-h-reader', 'INFJ', 'ar'),
    ('esfj-reader', 'ESFJ', 'ar');
  insert into public.chapters (book_id, position, title, body)
    select b.id, p.position, b.title || ' chapter ' || p.position, b.title || ' secret text ' || p.position
    from public.books b cross join (values (1), (2), (3)) as p(position);
  insert into public.entitlements (reader_id, book_id, active)
    select r.id, b.id, r.id <> '${REFUNDED_READER}'
    from public.readers r
    join public.books b on b.slug = case when r.id = '${ESFJ_READER}' then 'esfj-reader' else 'infj-t-h-reader' end;
`;

const DEVICE_1 = "device-one-0000000001";
const DEVICE_2 = "device-two-0000000002";
const DEVICE_3 = "device-three-00000003";

let db: PGlite;

async function as<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  query: string,
  params: unknown[] = [],
) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(query, params)).rows;
  } finally {
    await db.exec(`reset role`);
  }
}

const openChapter = (userId: string | null, slug: string, position: number, device = DEVICE_1) =>
  as<{ data: { chapter: { body: string; title: string }; reader: { name: string; email: string }; scroll_ratio: number } }>(
    "authenticated",
    userId,
    `select public.open_chapter($1, $2, $3) as data`,
    [slug, position, device],
  ).then((rows) => rows[0].data);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
}, 30_000);

beforeEach(async () => {
  await db.exec(`reset role`);
  await db.exec(`
    truncate public.test_results, public.test_settings,
      public.reading_log, public.reading_state, public.reader_prefs, public.devices,
      public.salla_events, public.salla_orders, public.salla_products,
      public.pending_entitlements, public.invites, public.entitlements, public.chapters, public.books, public.readers, public.admins,
      auth.users cascade;
  `);
  await db.exec(`set session_replication_role = replica`);
  await db.exec(SEED);
  await db.exec(`set session_replication_role = origin`);
});

describe("open_chapter", () => {
  it("gives a reader a chapter of their own book, with their name and email for the chapter footer", async () => {
    const data = await openChapter(INFJ_READER, "infj-t-h-reader", 1);
    expect(data.chapter.body).toBe("INFJ secret text 1");
    expect(data.reader).toEqual({ name: "Noura", email: "infj@example.com" });
  });

  it("falls back to the email when the reader has no display name", async () => {
    const data = await openChapter(ESFJ_READER, "esfj-reader", 1);
    expect(data.reader.name).toBe("esfj@example.com");
  });

  it("refuses an INFJ reader who asks for an ESFJ chapter", async () => {
    await expect(openChapter(INFJ_READER, "esfj-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("gives the same answer for a book that does not exist", async () => {
    await expect(openChapter(INFJ_READER, "no-such-book", 1)).rejects.toThrow("not_entitled");
  });

  it("refuses a visitor who is not signed in", async () => {
    await expect(
      as("anon", null, `select public.open_chapter('infj-t-h-reader', 1, '${DEVICE_1}')`),
    ).rejects.toThrow(/permission denied/);
    await expect(openChapter(null, "infj-t-h-reader", 1)).rejects.toThrow("not_authenticated");
  });

  it("refuses a deactivated reader", async () => {
    await expect(openChapter(INACTIVE_READER, "infj-t-h-reader", 1)).rejects.toThrow("reader_inactive");
  });

  it("refuses a reader whose entitlement was deactivated (refund)", async () => {
    await expect(openChapter(REFUNDED_READER, "infj-t-h-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("refuses a chapter that does not exist", async () => {
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 99)).rejects.toThrow("chapter_not_found");
  });

  it("logs every read", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 1);
    await openChapter(INFJ_READER, "infj-t-h-reader", 2);
    const rows = await db.query<{ n: number }>(`select count(*)::int as n from public.reading_log`);
    expect(rows.rows[0].n).toBe(2);
  });
});

describe("device limit", () => {
  it("allows two devices and refuses a third", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_1);
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_2);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_3)).rejects.toThrow("device_limit");
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_1)).resolves.toBeTruthy();
  });

  it("refuses a revoked device and frees its slot", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_1);
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_2);
    await db.exec(`update public.devices set revoked = true where device_id = '${DEVICE_1}'`);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_1)).rejects.toThrow("device_revoked");
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_3)).resolves.toBeTruthy();
  });

  it("rejects a malformed device id", async () => {
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, "short")).rejects.toThrow("device_invalid");
  });
});

describe("direct table access", () => {
  it("never exposes chapter text to signed-in readers or visitors", async () => {
    await expect(as("authenticated", INFJ_READER, `select body from public.chapters`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(as("anon", null, `select body from public.chapters`)).rejects.toThrow(/permission denied/);
  });

  it("never exposes the read log", async () => {
    await expect(as("authenticated", INFJ_READER, `select * from public.reading_log`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("shows a reader only their own account and entitlements", async () => {
    const readers = await as<{ email: string }>("authenticated", INFJ_READER, `select email from public.readers`);
    expect(readers).toEqual([{ email: "infj@example.com" }]);
    const entitlements = await as("authenticated", INFJ_READER, `select * from public.entitlements`);
    expect(entitlements).toHaveLength(1);
  });

  it("shows visitors nothing", async () => {
    expect(await as("anon", null, `select * from public.readers`)).toEqual([]);
    expect(await as("anon", null, `select * from public.books`)).toEqual([]);
  });

  it("lets a reader save only their own preferences", async () => {
    await as(
      "authenticated",
      INFJ_READER,
      `insert into public.reader_prefs (reader_id, font_size, theme) values ($1, 'lg', 'dark')`,
      [INFJ_READER],
    );
    await expect(
      as("authenticated", INFJ_READER, `insert into public.reader_prefs (reader_id) values ($1)`, [ESFJ_READER]),
    ).rejects.toThrow(/row-level security/);
  });

  it("saves the reading layout and refuses unknown ones", async () => {
    await as(
      "authenticated",
      INFJ_READER,
      `insert into public.reader_prefs (reader_id, layout) values ($1, 'laptop')`,
      [INFJ_READER],
    );
    await expect(
      as("authenticated", INFJ_READER, `update public.reader_prefs set layout = 'tablet' where reader_id = $1`, [
        INFJ_READER,
      ]),
    ).rejects.toThrow(/check constraint/);
  });

  it("does not let readers grant themselves a book", async () => {
    const esfj = await db.query<{ id: string }>(`select id from public.books where slug = 'esfj-reader'`);
    await expect(
      as(
        "authenticated",
        INFJ_READER,
        `insert into public.entitlements (reader_id, book_id) values ($1, $2)`,
        [INFJ_READER, esfj.rows[0].id],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as("authenticated", REFUNDED_READER, `update public.entitlements set active = true returning *`),
    ).resolves.toEqual([]);
  });

  it("keeps the internal helpers private", async () => {
    await expect(
      as("authenticated", INFJ_READER, `select public.claim_device($1, $2)`, [INFJ_READER, DEVICE_1]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("library, contents and progress", () => {
  it("lists only the reader's own books", async () => {
    const [{ data }] = await as<{ data: { slug: string }[] }>(
      "authenticated",
      INFJ_READER,
      `select public.my_library() as data`,
    );
    expect(data.map((b) => b.slug)).toEqual(["infj-t-h-reader"]);
  });

  it("gives chapter titles without chapter text", async () => {
    const [{ data }] = await as<{ data: { chapters: object[] } }>(
      "authenticated",
      INFJ_READER,
      `select public.book_toc('infj-t-h-reader') as data`,
    );
    expect(data.chapters).toEqual([
      { position: 1, title: "INFJ chapter 1" },
      { position: 2, title: "INFJ chapter 2" },
      { position: 3, title: "INFJ chapter 3" },
    ]);
    await expect(
      as("authenticated", INFJ_READER, `select public.book_toc('esfj-reader')`),
    ).rejects.toThrow("not_entitled");
  });

  it("remembers the chapter and scroll position", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 2);
    await as("authenticated", INFJ_READER, `select public.save_progress('infj-t-h-reader', 2, 0.4, '${DEVICE_1}')`);

    const [{ data }] = await as<{ data: { position: number } }>(
      "authenticated",
      INFJ_READER,
      `select public.book_toc('infj-t-h-reader') as data`,
    );
    expect(data.position).toBe(2);

    const reopened = await openChapter(INFJ_READER, "infj-t-h-reader", 2);
    expect(reopened.scroll_ratio).toBeCloseTo(0.4);

    const other = await openChapter(INFJ_READER, "infj-t-h-reader", 3);
    expect(other.scroll_ratio).toBe(0);
  });

  it("does not save progress in someone else's book", async () => {
    await expect(
      as("authenticated", INFJ_READER, `select public.save_progress('esfj-reader', 1, 0.5, '${DEVICE_1}')`),
    ).rejects.toThrow("not_entitled");
  });

  it("does not let a blocked third device move the saved position", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 2, DEVICE_1);
    await openChapter(INFJ_READER, "infj-t-h-reader", 2, DEVICE_2);
    await expect(
      as("authenticated", INFJ_READER, `select public.save_progress('infj-t-h-reader', 3, 0.9, '${DEVICE_3}')`),
    ).rejects.toThrow("device_limit");
    const [{ data }] = await as<{ data: { position: number } }>(
      "authenticated",
      INFJ_READER,
      `select public.book_toc('infj-t-h-reader') as data`,
    );
    expect(data.position).toBe(2);
  });
});

describe("owner panel", () => {
  const dashboard = (userId: string) =>
    as<{ data: { readers: { email: string; books: { slug: string; active: boolean }[] }[] } }>(
      "authenticated",
      userId,
      `select public.admin_dashboard() as data`,
    ).then((rows) => rows[0].data);

  it("knows who the owner is", async () => {
    expect(await as("authenticated", OWNER, `select public.is_admin() as v`)).toEqual([{ v: true }]);
    expect(await as("authenticated", INFJ_READER, `select public.is_admin() as v`)).toEqual([{ v: false }]);
    await expect(as("anon", null, `select public.is_admin()`)).rejects.toThrow(/permission denied/);
  });

  it("refuses every owner action from a reader", async () => {
    for (const call of [
      `select public.admin_dashboard()`,
      `select public.admin_set_reader_active('${ESFJ_READER}', false)`,
      `select public.admin_set_entitlement('${INFJ_READER}', 'esfj-reader', true)`,
      `select public.admin_revoke_device('${ESFJ_READER}', '${DEVICE_1}')`,
      `select public.admin_add_reader('new@example.com', null, 'infj-t-h-reader')`,
    ]) {
      await expect(as("authenticated", INFJ_READER, call)).rejects.toThrow("not_admin");
    }
    await expect(as("authenticated", INFJ_READER, `select * from public.admins`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("lets the owner add a reader who already has an account, with exactly one book", async () => {
    const [{ v }] = await as<{ v: string }>(
      "authenticated",
      OWNER,
      `select public.admin_add_reader('New@Example.com', 'Sara', 'infj-t-h-reader') as v`,
    );
    expect(v).toBe("linked");
    const data = await openChapter(NEW_USER, "infj-t-h-reader", 1);
    expect(data.reader).toEqual({ name: "Sara", email: "new@example.com" });
    await expect(openChapter(NEW_USER, "esfj-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("invites a new email and opens the book at its first sign-in, without the password", async () => {
    const [{ v }] = await as<{ v: string }>(
      "authenticated",
      OWNER,
      `select public.admin_add_reader('later@example.com', 'Laila', 'infj-t-h-reader') as v`,
    );
    expect(v).toBe("invited");

    // What Supabase Auth does when the invited reader signs in for the first time.
    const LATER = "00000000-0000-4000-8000-0000000000cc";
    await db.query(`insert into auth.users (id, email, encrypted_password) values ($1, 'later@example.com', 'x')`, [LATER]);
    const user = await db.query<{ p: string }>(`select encrypted_password as p from auth.users where id = $1`, [LATER]);
    expect(user.rows[0].p).toBe("");

    const data = await openChapter(LATER, "infj-t-h-reader", 1);
    expect(data.reader.name).toBe("Laila");
    await expect(openChapter(LATER, "esfj-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("refuses a sign-up from an email nobody invited", async () => {
    await expect(
      db.query(`insert into auth.users (email) values ('stranger@example.com')`),
    ).rejects.toThrow("signup_not_allowed");
  });

  it("makes an invited owner an admin, not a reader", async () => {
    await db.query(`insert into public.invites (email, is_admin) values ('boss@example.com', true)`);
    const BOSS = "00000000-0000-4000-8000-0000000000dd";
    await db.query(`insert into auth.users (id, email) values ($1, 'boss@example.com')`, [BOSS]);
    expect(await as("authenticated", BOSS, `select public.is_admin() as v`)).toEqual([{ v: true }]);
    await expect(openChapter(BOSS, "infj-t-h-reader", 1)).rejects.toThrow("reader_inactive");
  });

  it("lets readers fetch figures only for books they own", async () => {
    const check = (userId: string | null, slug: string) =>
      as<{ v: boolean }>("authenticated", userId, `select public.can_read_book_files($1) as v`, [slug]).then(
        (rows) => rows[0].v,
      );
    expect(await check(INFJ_READER, "infj-t-h-reader")).toBe(true);
    expect(await check(INFJ_READER, "esfj-reader")).toBe(false);
    expect(await check(REFUNDED_READER, "infj-t-h-reader")).toBe(false);
    expect(await check(null, "infj-t-h-reader")).toBe(false);
  });

  it("suspends a reader and unlinks a book without deleting anything", async () => {
    await as("authenticated", OWNER, `select public.admin_set_reader_active('${INFJ_READER}', false)`);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1)).rejects.toThrow("reader_inactive");
    await as("authenticated", OWNER, `select public.admin_set_reader_active('${INFJ_READER}', true)`);

    await as("authenticated", OWNER, `select public.admin_set_entitlement('${INFJ_READER}', 'infj-t-h-reader', false)`);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1)).rejects.toThrow("not_entitled");

    const readers = await dashboard(OWNER);
    const infj = readers.readers.find((r) => r.email === "infj@example.com");
    expect(infj?.books).toEqual([expect.objectContaining({ slug: "infj-t-h-reader", active: false })]);
  });

  it("frees a device slot when the owner removes a device", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_1);
    await openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_2);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_3)).rejects.toThrow("device_limit");
    await as("authenticated", OWNER, `select public.admin_revoke_device('${INFJ_READER}', '${DEVICE_1}')`);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1, DEVICE_3)).resolves.toBeTruthy();
  });

  it("shows who read what", async () => {
    await openChapter(INFJ_READER, "infj-t-h-reader", 2);
    const [{ data }] = await as<{ data: { reads: { email: string; chapter: string }[] } }>(
      "authenticated",
      OWNER,
      `select public.admin_dashboard() as data`,
    );
    expect(data.reads[0]).toEqual(expect.objectContaining({ email: "infj@example.com", chapter: "INFJ chapter 2" }));
  });
});

describe("salla purchases", () => {
  const BUYER = NEW_USER;
  const grant = (orderId: string, skus: string[], email = "new@example.com") =>
    as<{ data: { books: string[]; unknown_skus: string[]; pending: boolean } }>(
      "service_role",
      null,
      `select public.salla_grant_email($1, $2, 'Buyer', $3) as data`,
      [orderId, email, skus],
    ).then((rows) => rows[0].data);
  const revoke = (orderId: string) =>
    as<{ n: number }>("service_role", null, `select public.salla_revoke_order($1) as n`, [orderId]).then(
      (rows) => rows[0].n,
    );

  beforeEach(async () => {
    await as("authenticated", OWNER, `select public.admin_set_salla_product('SKU-INFJ', 'infj-t-h-reader')`);
  });

  it("unlocks the purchased book, and only that book", async () => {
    const result = await grant("1001", ["SKU-INFJ", "SKU-OTHER"]);
    expect(result).toEqual({ books: ["infj-t-h-reader"], unknown_skus: ["SKU-OTHER"], pending: false });
    await expect(openChapter(BUYER, "infj-t-h-reader", 1)).resolves.toBeTruthy();
    await expect(openChapter(BUYER, "esfj-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("is safe to receive twice", async () => {
    await grant("1001", ["SKU-INFJ"]);
    await grant("1001", ["SKU-INFJ"]);
    const rows = await db.query<{ n: number }>(`select count(*)::int as n from public.entitlements where reader_id = $1`, [BUYER]);
    expect(rows.rows[0].n).toBe(1);
  });

  it("locks the book again on refund, but leaves manual links alone", async () => {
    await grant("1001", ["SKU-INFJ"]);
    expect(await revoke("1001")).toBe(1);
    await expect(openChapter(BUYER, "infj-t-h-reader", 1)).rejects.toThrow("not_entitled");

    // INFJ_READER's link was made by hand; an order for it must not remove it.
    await grant("2002", ["SKU-INFJ"], "infj@example.com");
    expect(await revoke("2002")).toBe(0);
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1)).resolves.toBeTruthy();
  });

  it("does not reactivate a reader the owner suspended", async () => {
    await as("authenticated", OWNER, `select public.admin_set_reader_active('${INFJ_READER}', false)`);
    await grant("3003", ["SKU-INFJ"], "infj@example.com");
    await expect(openChapter(INFJ_READER, "infj-t-h-reader", 1)).rejects.toThrow("reader_inactive");
  });

  it("holds the book for a buyer without an account until their first sign-in", async () => {
    const result = await grant("5005", ["SKU-INFJ"], "fresh@example.com");
    expect(result.pending).toBe(true);
    const FRESH = "00000000-0000-4000-8000-0000000000ee";
    await db.query(`insert into auth.users (id, email) values ($1, 'fresh@example.com')`, [FRESH]);
    await expect(openChapter(FRESH, "infj-t-h-reader", 1)).resolves.toBeTruthy();
    expect(await revoke("5005")).toBe(1);
    await expect(openChapter(FRESH, "infj-t-h-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("cancels a book still waiting for the first sign-in when the order is refunded", async () => {
    await grant("6006", ["SKU-INFJ"], "gone@example.com");
    expect(await revoke("6006")).toBe(1);
    const GONE = "00000000-0000-4000-8000-0000000000ff";
    await db.query(`insert into auth.users (id, email) values ($1, 'gone@example.com')`, [GONE]);
    await expect(openChapter(GONE, "infj-t-h-reader", 1)).rejects.toThrow("not_entitled");
  });

  it("cannot be called by readers or visitors", async () => {
    for (const role of ["authenticated", "anon"] as const) {
      await expect(
        as(role, INFJ_READER, `select public.salla_grant_email('x', 'infj@example.com', '', '{SKU-INFJ}')`),
      ).rejects.toThrow(/permission denied/);
      await expect(as(role, INFJ_READER, `select public.salla_revoke_order('x')`)).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(as("authenticated", INFJ_READER, `select public.admin_salla()`)).rejects.toThrow("not_admin");
    await expect(
      as("authenticated", INFJ_READER, `select public.admin_set_salla_product('X', 'esfj-reader')`),
    ).rejects.toThrow("not_admin");
    await expect(as("authenticated", INFJ_READER, `select * from public.salla_events`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("shows the owner the product mapping", async () => {
    const [{ data }] = await as<{ data: { products: { sku: string; book: string }[] } }>(
      "authenticated",
      OWNER,
      `select public.admin_salla() as data`,
    );
    expect(data.products).toEqual([expect.objectContaining({ sku: "SKU-INFJ", book: "infj-t-h-reader" })]);
  });
});

describe("type test results", () => {
  const save = (userId: string, key: string, answers: object) =>
    as(
      "authenticated",
      userId,
      `insert into public.test_results (key, user_id, answers) values ($1, $2, $3)
       on conflict (key) do update set answers = excluded.answers`,
      [key, userId, JSON.stringify(answers)],
    );

  it("lets a reader save and read back their own attempt", async () => {
    await save(INFJ_READER, INFJ_READER, { status: "open", answers: [0] });
    await save(INFJ_READER, INFJ_READER, { status: "done", answers: [0, 1] });
    const rows = await as<{ answers: { status: string } }>(
      "authenticated",
      INFJ_READER,
      `select answers from public.test_results`,
    );
    expect(rows.map((r) => r.answers.status)).toEqual(["done"]);
  });

  it("never shows a reader someone else's attempt", async () => {
    await save(ESFJ_READER, ESFJ_READER, { status: "done", name: "secret" });
    expect(await as("authenticated", INFJ_READER, `select * from public.test_results`)).toEqual([]);
    await expect(as("anon", null, `select * from public.test_results`)).rejects.toThrow(/permission denied/);
  });

  it("refuses a reader writing another account's attempt or another key", async () => {
    await expect(save(INFJ_READER, ESFJ_READER, { status: "done" })).rejects.toThrow(/row-level security/);
    await expect(
      as(
        "authenticated",
        INFJ_READER,
        `insert into public.test_results (key, user_id, answers) values ('trial_1', $1, '{}')`,
        [INFJ_READER],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let a reader overwrite someone else's attempt", async () => {
    await save(ESFJ_READER, ESFJ_READER, { status: "done" });
    const updated = await as(
      "authenticated",
      INFJ_READER,
      `update public.test_results set answers = '{"status":"open"}' where key = $1 returning key`,
      [ESFJ_READER],
    );
    expect(updated).toEqual([]);
  });

  it("keeps a reader's row on their own key and account", async () => {
    await save(INFJ_READER, INFJ_READER, { status: "open" });
    await as(
      "authenticated",
      INFJ_READER,
      `update public.test_results set created_at = '2000-01-01' where key = $1`,
      [INFJ_READER],
    );
    const [row] = await as<{ created_at: Date }>(
      "service_role",
      null,
      `select created_at from public.test_results where key = $1`,
      [INFJ_READER],
    );
    expect(new Date(row.created_at).getFullYear()).toBeGreaterThan(2000);
  });

  it("does not let a reader delete their attempt", async () => {
    await save(INFJ_READER, INFJ_READER, { status: "done" });
    await expect(as("authenticated", INFJ_READER, `delete from public.test_results`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("closes a finished attempt: the reader cannot restart or change their own result", async () => {
    const finished = { status: "done", path: "branch", answers: [0, 1], br: { ans: { q1: 0 }, order: ["q1"] } };
    await save(INFJ_READER, INFJ_READER, finished);
    await expect(save(INFJ_READER, INFJ_READER, { ...finished, status: "open" })).rejects.toThrow("test_closed");
    await expect(save(INFJ_READER, INFJ_READER, { ...finished, answers: [3, 3] })).rejects.toThrow("test_closed");
    await expect(
      save(INFJ_READER, INFJ_READER, { ...finished, br: { ...finished.br, ans: { q1: 2 } } }),
    ).rejects.toThrow("test_closed");
    // Describing someone else after one's own result is part of the test.
    await save(INFJ_READER, INFJ_READER, { ...finished, br: { ...finished.br, obs: { og: "f", ans: { o1: 1 } } } });
  });

  it("lets an attempt that only described someone else go on to the reader's own test", async () => {
    await save(INFJ_READER, INFJ_READER, { status: "done", mode: "obs", br: { obs: { done: true } } });
    await save(INFJ_READER, INFJ_READER, { status: "open", mode: null, phase: "welcome", br: { arch: [{}] } });
  });

  it("lets a suspended reader read their result but not change it", async () => {
    await expect(save(INACTIVE_READER, INACTIVE_READER, { status: "open" })).rejects.toThrow(/row-level security/);
    await as(
      "service_role",
      null,
      `insert into public.test_results (key, user_id, answers) values ($1, $2, '{"status":"done"}')`,
      [INACTIVE_READER, INACTIVE_READER],
    );
    const rows = await as("authenticated", INACTIVE_READER, `select key from public.test_results`);
    expect(rows).toHaveLength(1);
  });

  it("lets the owner read every attempt and save trials and reopened attempts", async () => {
    await save(INFJ_READER, INFJ_READER, { status: "done", answers: [1] });
    await save(ESFJ_READER, ESFJ_READER, { status: "open" });
    const rows = await as<{ key: string }>("authenticated", OWNER, `select key from public.test_results order by key`);
    expect(rows.map((r) => r.key)).toEqual([INFJ_READER, ESFJ_READER].sort());
    await as(
      "authenticated",
      OWNER,
      `insert into public.test_results (key, answers) values ('trial_1', '{"trial":true}')`,
    );
    await as(
      "authenticated",
      OWNER,
      `update public.test_results set answers = '{"reopened":1}' where key = $1`,
      [INFJ_READER],
    );
    const [reopened] = await as<{ answers: { reopened: number }; user_id: string }>(
      "authenticated",
      INFJ_READER,
      `select answers, user_id from public.test_results`,
    );
    expect(reopened).toEqual({ answers: { reopened: 1 }, user_id: INFJ_READER });
  });

  it("lets only the owner choose the test path, and every signed-in reader read it", async () => {
    await expect(
      as("authenticated", INFJ_READER, `insert into public.test_settings (path) values ('branch')`),
    ).rejects.toThrow(/row-level security/);
    await as("authenticated", OWNER, `insert into public.test_settings (path) values ('branch')`);
    const rows = await as<{ path: string }>("authenticated", INFJ_READER, `select path from public.test_settings`);
    expect(rows).toEqual([{ path: "branch" }]);
    await expect(
      as("authenticated", OWNER, `insert into public.test_settings (id, path) values (true, 'nonsense')`),
    ).rejects.toThrow(/check constraint|duplicate key/);
    await expect(as("anon", null, `select * from public.test_settings`)).rejects.toThrow(/permission denied/);
  });
});
