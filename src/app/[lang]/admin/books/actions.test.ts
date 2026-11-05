import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_LINE } from "@/lib/book-import";

// A tiny stand-in for the two Supabase clients: who is signed in, and what the
// service client is asked to write.
let isAdmin = true;
let serviceKey = true;
let existingBook: { id: string } | null = null;
let existingChapters = 0;
const writes: { table: string; op: string; payload: unknown }[] = [];
const uploads: string[] = [];

let updateResult: { data: unknown; error: { code: string } | null } = { data: [{ id: "x" }], error: null };

function table(name: string) {
  let op = "select";
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    maybeSingle: async () => ({ data: name === "books" ? existingBook : { title: "أ", body: "نص" }, error: null }),
    then: (resolve: (value: unknown) => void) =>
      resolve(
        op === "update"
          ? updateResult
          : name === "chapters"
            ? { count: existingChapters, data: [{ position: 1, title: "أ" }], error: null }
            : { data: [], error: null },
      ),
    insert: async (payload: unknown) => (writes.push({ table: name, op: "insert", payload }), { error: null }),
    update: (payload: unknown) => {
      op = "update";
      writes.push({ table: name, op: "update", payload });
      return query;
    },
    upsert: async (payload: unknown) => (writes.push({ table: name, op: "upsert", payload }), { error: null }),
  };
  return query;
}

vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: async () => ({ data: isAdmin }) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () =>
    serviceKey
      ? {
          from: table,
          storage: {
            from: () => ({ upload: async (path: string) => (uploads.push(path), { error: null }) }),
          },
        }
      : null,
}));

const { listChapters, loadChapter, prepareBook, saveChapter, saveChapters, setBookActive, uploadFigure } =
  await import("./actions");

const meta = { slug: "infj-t-h-novel", title: "رواية", lang: "ar" as const, typeCode: "INFJ-T-H", kind: "novel" as const };

beforeEach(() => {
  isAdmin = true;
  serviceKey = true;
  existingBook = null;
  existingChapters = 0;
  updateResult = { data: [{ id: "x" }], error: null };
  writes.length = 0;
  uploads.length = 0;
});

describe("book import from the owner panel", () => {
  it("refuses anyone who is not the owner, before touching the service key", async () => {
    isAdmin = false;
    expect(await prepareBook(meta, 3, "new")).toEqual({ ok: false, error: "notOwner" });
    expect(await saveChapters(meta.slug, [{ position: 1, title: "أ", body: SUPPORT_LINE }])).toEqual({
      ok: false,
      error: "notOwner",
    });
    const form = new FormData();
    form.set("slug", meta.slug);
    form.set("file", new File(["x"], "a.png"));
    expect(await uploadFigure(form)).toEqual({ ok: false, error: "notOwner" });
    expect(writes).toEqual([]);
    expect(uploads).toEqual([]);
  });

  it("says so when the service key is not set", async () => {
    serviceKey = false;
    expect(await prepareBook(meta, 3, "new")).toEqual({ ok: false, error: "noServiceKey" });
  });

  it("adds a new book, and refuses bad slugs and types", async () => {
    expect(await prepareBook(meta, 3, "new")).toEqual({ ok: true, existed: false });
    expect(writes[0]).toMatchObject({ table: "books", op: "insert" });
    expect(await prepareBook({ ...meta, slug: "Bad Slug" }, 3, "new")).toMatchObject({ error: "invalidBook" });
    expect(await prepareBook({ ...meta, typeCode: "infj!" }, 3, "new")).toMatchObject({ error: "invalidBook" });
  });

  it("never lets an update drop chapters", async () => {
    existingBook = { id: "book-1" };
    existingChapters = 5;
    expect(await prepareBook(meta, 4, "update")).toEqual({ ok: false, error: "fewerChapters" });
    expect(await prepareBook(meta, 5, "update")).toEqual({ ok: true, existed: true });
  });

  it("never lets a new book take an existing book's slug", async () => {
    existingBook = { id: "book-1" };
    expect(await prepareBook(meta, 5, "new")).toEqual({ ok: false, error: "slugTaken" });
    existingBook = null;
    expect(await prepareBook(meta, 5, "update")).toEqual({ ok: false, error: "notFound" });
    expect(writes).toEqual([]);
  });

  it("checks the support line again on the server", async () => {
    existingBook = { id: "book-1" };
    expect(await saveChapters(meta.slug, [{ position: 1, title: "أ", body: "نص" }])).toMatchObject({
      error: "supportLine",
      position: 1,
    });
    expect(
      await saveChapters(meta.slug, [{ position: 2, title: "ب", body: `نص\n${SUPPORT_LINE}` }]),
    ).toMatchObject({ error: "supportLine", position: 2 });
    expect(
      await saveChapters(meta.slug, [
        { position: 1, title: "أ", body: `${SUPPORT_LINE}\r\n\r\nنص` },
        { position: 2, title: "ب", body: "نص" },
      ]),
    ).toEqual({ ok: true });
    expect(writes.at(-1)).toMatchObject({ table: "chapters", op: "upsert" });
  });

  it("uploads figures only under plain names, into the book's folder", async () => {
    existingBook = { id: "book-1" };
    const form = (name: string) => {
      const data = new FormData();
      data.set("slug", meta.slug);
      data.set("file", new File(["x"], name));
      return data;
    };
    expect(await uploadFigure(form("../evil.png"))).toMatchObject({ error: "invalidFigure" });
    expect(await uploadFigure(form("شكل.png"))).toMatchObject({ error: "invalidFigure" });
    expect(await uploadFigure(form("drawing.svg"))).toMatchObject({ error: "invalidFigure" });
    expect(await uploadFigure(form("fig-1.png"))).toEqual({ ok: true });
    expect(uploads).toEqual(["infj-t-h-novel/figures/fig-1.png"]);
  });
});

describe("editing a book from the owner panel", () => {
  it("refuses anyone who is not the owner", async () => {
    isAdmin = false;
    existingBook = { id: "book-1" };
    expect(await listChapters(meta.slug)).toEqual({ ok: false, error: "notOwner" });
    expect(await loadChapter(meta.slug, 1)).toEqual({ ok: false, error: "notOwner" });
    expect(await saveChapter(meta.slug, { position: 2, title: "ب", body: "نص" })).toEqual({
      ok: false,
      error: "notOwner",
    });
    expect(await setBookActive(meta.slug, false)).toEqual({ ok: false, error: "notOwner" });
    expect(writes).toEqual([]);
  });

  it("lists and loads chapters for the owner", async () => {
    existingBook = { id: "book-1" };
    expect(await listChapters(meta.slug)).toEqual({ ok: true, chapters: [{ position: 1, title: "أ" }] });
    expect(await loadChapter(meta.slug, 1)).toEqual({ ok: true, title: "أ", body: "نص" });
    existingBook = null;
    expect(await listChapters(meta.slug)).toEqual({ ok: false, error: "notFound" });
  });

  it("saves an edited chapter with the importer's checks", async () => {
    existingBook = { id: "book-1" };
    expect(await saveChapter(meta.slug, { position: 1, title: "أ", body: "بلا سطر الدعم" })).toMatchObject({
      error: "supportLine",
    });
    expect(await saveChapter(meta.slug, { position: 2, title: "ب", body: "نص جديد" })).toEqual({ ok: true });
    expect(writes.at(-1)).toMatchObject({ table: "chapters", op: "update", payload: { title: "ب", body: "نص جديد" } });
    updateResult = { data: [], error: null };
    expect(await saveChapter(meta.slug, { position: 99, title: "ب", body: "نص" })).toMatchObject({ error: "notFound" });
  });

  it("takes a book down by its flag only, and says when the migration is missing", async () => {
    expect(await setBookActive(meta.slug, false)).toEqual({ ok: true });
    expect(writes.at(-1)).toEqual({ table: "books", op: "update", payload: { active: false } });
    updateResult = { data: null, error: { code: "42703" } };
    expect(await setBookActive(meta.slug, false)).toEqual({ ok: false, error: "migrationPending" });
    updateResult = { data: null, error: { code: "PGRST204" } };
    expect(await setBookActive(meta.slug, false)).toEqual({ ok: false, error: "migrationPending" });
    updateResult = { data: null, error: { code: "57014" } };
    expect(await setBookActive(meta.slug, false)).toEqual({ ok: false, error: "failed" });
  });
});
