import { beforeEach, describe, expect, it, vi } from "vitest";

let isAdmin = true;
let serviceKey = true;
const tables: Record<string, unknown[]> = {};
const touched: string[] = [];

function table(name: string) {
  touched.push(name);
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: tables[name]?.[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: tables[name] ?? [], error: null }),
  };
  return query;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: async () => ({ data: isAdmin }) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () =>
    serviceKey
      ? {
          from: table,
          auth: { admin: { getUserById: async () => ({ data: { user: { last_sign_in_at: "2026-11-05T00:00:00Z" } } }) } },
        }
      : null,
}));

const { loadProgress, loadReaderDetail, ownerService } = await import("./reader-data");

const R = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  isAdmin = true;
  serviceKey = true;
  touched.length = 0;
  for (const key of Object.keys(tables)) delete tables[key];
  tables.books = [{ id: "b1", slug: "infj" }];
  tables.chapters = [1, 2, 3, 4].map((position) => ({ id: `c${position}`, book_id: "b1", position, title: `T${position}` }));
  tables.reader_chapter_overrides = [{ reader_id: R, chapter_id: "c2" }];
  tables.reading_state = [{ reader_id: R, book_id: "b1", chapter_id: "c3", updated_at: "2026-11-04T00:00:00Z" }];
});

describe("the owner's view of readers", () => {
  it("is closed to anyone who is not the owner, before the service key is used", async () => {
    isAdmin = false;
    expect(await ownerService()).toEqual({ error: "notOwner" });
    expect(touched).toEqual([]);
  });

  it("says when the service key is missing", async () => {
    serviceKey = false;
    expect(await ownerService()).toEqual({ error: "noServiceKey" });
  });

  it("computes each reader's place, leaving out their hidden chapters", async () => {
    const owner = await ownerService();
    if (!("service" in owner)) throw new Error("expected the owner");
    expect(await loadProgress(owner.service, [R])).toEqual({
      [R]: { infj: { index: 2, total: 3, percent: 67, title: "T3", updatedAt: "2026-11-04T00:00:00Z" } },
    });
    expect(await loadProgress(owner.service, [])).toEqual({});
  });

  it("gathers one reader's books, opened chapters and timeline", async () => {
    tables.readers = [{ id: R, email: "n@example.com", display_name: "Noura", active: true, created_at: "2026-11-01T00:00:00Z" }];
    tables.entitlements = [{ book_id: "b1", active: true, source: "manual", books: { slug: "infj", title: "INFJ", lang: "ar" } }];
    tables.reading_state = [{ book_id: "b1", chapter_id: "c3", updated_at: "2026-11-04T00:00:00Z" }];
    tables.reading_log = [
      { chapter_id: "c3", opened_at: "2026-11-04T00:00:00Z" },
      { chapter_id: "c1", opened_at: "2026-11-03T00:00:00Z" },
      { chapter_id: "c1", opened_at: "2026-11-02T00:00:00Z" },
    ];
    tables.test_results = [{ key: R, updated_at: "2026-11-03T00:00:00Z", status: "done", name: "Noura" }];
    const owner = await ownerService();
    if (!("service" in owner)) throw new Error("expected the owner");
    const detail = await loadReaderDetail(owner.service, R);
    expect(detail?.lastSignIn).toBe("2026-11-05T00:00:00Z");
    expect(detail?.books[0]).toMatchObject({
      slug: "infj",
      opened: 2,
      firstOpened: "2026-11-02T00:00:00Z",
      lastOpened: "2026-11-04T00:00:00Z",
      progress: { index: 2, total: 3, title: "T3" },
    });
    expect(detail?.timeline.map((row) => row.chapter)).toEqual(["T3", "T1", "T1"]);
    expect(detail?.tests).toEqual([{ key: R, status: "done", name: "Noura", updatedAt: "2026-11-03T00:00:00Z" }]);
  });

  it("returns nothing for an unknown reader", async () => {
    const owner = await ownerService();
    if (!("service" in owner)) throw new Error("expected the owner");
    expect(await loadReaderDetail(owner.service, R)).toBeNull();
  });
});
