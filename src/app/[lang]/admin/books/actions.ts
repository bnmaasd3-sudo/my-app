"use server";

import { refresh } from "next/cache";
import {
  BOOK_KINDS,
  FIGURE_NAME,
  MAX_CHAPTER,
  MAX_FIGURE,
  checkBookMeta,
  figureContentType,
  missingColumn,
  supportLineProblem,
} from "@/lib/book-import";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BookMeta = {
  slug: string;
  title: string;
  lang: "ar" | "en";
  typeCode: string | null;
  kind: "encyclopedia" | "novel" | "appendix";
};

export type ImportError =
  | "notOwner"
  | "noServiceKey"
  | "slugTaken"
  | "invalidBook"
  | "fewerChapters"
  | "invalidChapter"
  | "supportLine"
  | "tooLarge"
  | "notFound"
  | "invalidFigure"
  | "migrationPending"
  | "failed";

export type ImportResult = { ok: true; existed?: boolean } | { ok: false; error: ImportError; position?: number };

/**
 * The service client, for the owner only. Every action checks the signed-in
 * account with is_admin first: books and chapters are closed to everyone else,
 * so writing them needs the service key, which must never answer a reader.
 */
async function ownerService(): Promise<
  { service: NonNullable<ReturnType<typeof createServiceClient>> } | { error: "notOwner" | "noServiceKey" }
> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: "notOwner" };
  const service = createServiceClient();
  if (!service) return { error: "noServiceKey" };
  return { service };
}

function validMeta(meta: BookMeta): BookMeta | null {
  const clean: BookMeta = {
    slug: String(meta?.slug ?? "").trim(),
    title: String(meta?.title ?? "").trim().slice(0, 300),
    lang: meta?.lang === "en" ? "en" : "ar",
    typeCode: meta?.typeCode ? String(meta.typeCode).trim().toUpperCase() : null,
    kind: (BOOK_KINDS as string[]).includes(meta?.kind) ? meta.kind : "encyclopedia",
  };
  if (!clean.title) return null;
  try {
    checkBookMeta(clean);
  } catch {
    return null;
  }
  return clean;
}

/**
 * Adds a new book (refused if the slug is taken), or updates the title,
 * language, type and kind of an existing one. An update may not have fewer
 * chapters than the book already has: chapters are never deleted (their reads
 * and saved places point at them).
 */
export async function prepareBook(
  meta: BookMeta,
  chapterCount: number,
  mode: "new" | "update",
): Promise<ImportResult> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  const book = validMeta(meta);
  if (!book || !Number.isInteger(chapterCount) || chapterCount < 1) return { ok: false, error: "invalidBook" };

  const { service } = owner;
  const { data: existing, error } = await service.from("books").select("id").eq("slug", book.slug).maybeSingle();
  if (error) return { ok: false, error: "failed" };

  const row = { title: book.title, lang: book.lang, type_code: book.typeCode, kind: book.kind };
  if (mode === "new" && existing) return { ok: false, error: "slugTaken" };
  if (mode === "update" && !existing) return { ok: false, error: "notFound" };
  if (existing) {
    const { count, error: countError } = await service
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("book_id", existing.id);
    if (countError || count === null) return { ok: false, error: "failed" };
    if (count > chapterCount) return { ok: false, error: "fewerChapters" };
    const { error: updateError } = await service.from("books").update(row).eq("id", existing.id);
    return updateError ? { ok: false, error: "failed" } : { ok: true, existed: true };
  }
  const { error: insertError } = await service.from("books").insert({ slug: book.slug, ...row });
  return insertError ? { ok: false, error: "failed" } : { ok: true, existed: false };
}

type ChapterRow = { position: number; title: string; body: string };


/** One chapter as the browser sent it, checked: shape, size and the support-line rule. */
function checkChapter(chapter: unknown): ChapterRow | { error: ImportError; position?: number } {
  const raw = (chapter ?? {}) as Partial<ChapterRow>;
  const position = Number(raw.position);
  const title = String(raw.title ?? "").trim();
  const body = String(raw.body ?? "").replace(/\r\n?/g, "\n");
  if (!Number.isInteger(position) || position < 1 || position > 10_000 || !title || title.length > 300 || !body.trim()) {
    return { error: "invalidChapter", position: Number.isInteger(position) ? position : undefined };
  }
  if (body.length > MAX_CHAPTER) return { error: "tooLarge", position };
  if (supportLineProblem(position, body)) return { error: "supportLine", position };
  return { position, title, body };
}

/**
 * Saves some of the book's chapters (the panel sends them in batches). Each is
 * checked again here: the browser's preview is only a preview.
 */
export async function saveChapters(
  slug: string,
  chapters: { position: number; title: string; body: string }[],
  last = true,
): Promise<ImportResult> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  if (!Array.isArray(chapters) || chapters.length === 0 || chapters.length > 200) {
    return { ok: false, error: "invalidChapter" };
  }

  const rows: ChapterRow[] = [];
  for (const chapter of chapters) {
    const checked = checkChapter(chapter);
    if ("error" in checked) return { ok: false, ...checked };
    rows.push(checked);
  }

  const { service } = owner;
  const { data: book } = await service.from("books").select("id").eq("slug", String(slug)).maybeSingle();
  if (!book) return { ok: false, error: "notFound" };

  const { error } = await service
    .from("chapters")
    .upsert(
      rows.map((row) => ({ book_id: book.id, ...row })),
      { onConflict: "book_id,position" },
    );
  if (error) return { ok: false, error: "failed" };
  // Re-render the panel once, after the last batch.
  if (last) refresh();
  return { ok: true };
}

/** Uploads one figure to the private bucket at <slug>/figures/<name>, replacing one of the same name. */
export async function uploadFigure(formData: FormData): Promise<ImportResult> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };

  const slug = String(formData.get("slug") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || !FIGURE_NAME.test(file.name)) return { ok: false, error: "invalidFigure" };
  if (file.size === 0 || file.size > MAX_FIGURE) return { ok: false, error: "tooLarge" };

  const { service } = owner;
  const { data: book } = await service.from("books").select("id").eq("slug", slug).maybeSingle();
  if (!book) return { ok: false, error: "notFound" };

  const { error } = await service.storage
    .from("figures")
    .upload(`${slug}/figures/${file.name}`, file, { upsert: true, contentType: figureContentType(file.name) });
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export type ChapterList = { ok: true; chapters: { position: number; title: string }[] } | { ok: false; error: ImportError };
export type ChapterText = { ok: true; title: string; body: string } | { ok: false; error: ImportError };

async function bookId(service: NonNullable<ReturnType<typeof createServiceClient>>, slug: string) {
  const { data } = await service.from("books").select("id").eq("slug", String(slug)).maybeSingle();
  return data?.id as string | undefined;
}

/** The chapters of a book, titles only, for the owner's editor. */
export async function listChapters(slug: string): Promise<ChapterList> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  const id = await bookId(owner.service, slug);
  if (!id) return { ok: false, error: "notFound" };
  const { data, error } = await owner.service
    .from("chapters")
    .select("position, title")
    .eq("book_id", id)
    .order("position");
  return error ? { ok: false, error: "failed" } : { ok: true, chapters: data ?? [] };
}

/** One chapter's title and text, for the owner to edit. */
export async function loadChapter(slug: string, position: number): Promise<ChapterText> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  const id = await bookId(owner.service, slug);
  if (!id) return { ok: false, error: "notFound" };
  const { data, error } = await owner.service
    .from("chapters")
    .select("title, body")
    .eq("book_id", id)
    .eq("position", Number(position))
    .maybeSingle();
  if (error) return { ok: false, error: "failed" };
  return data ? { ok: true, title: data.title, body: data.body } : { ok: false, error: "notFound" };
}

/** Saves the owner's edit of one existing chapter, with the importer's checks. */
export async function saveChapter(slug: string, chapter: ChapterRow): Promise<ImportResult> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  const checked = checkChapter(chapter);
  if ("error" in checked) return { ok: false, ...checked };
  const id = await bookId(owner.service, slug);
  if (!id) return { ok: false, error: "notFound" };
  const { data, error } = await owner.service
    .from("chapters")
    .update({ title: checked.title, body: checked.body })
    .eq("book_id", id)
    .eq("position", checked.position)
    .select("id");
  if (error) return { ok: false, error: "failed" };
  if (!data || data.length === 0) return { ok: false, error: "notFound", position: checked.position };
  refresh();
  return { ok: true };
}

/**
 * Takes a book down (hidden from every library, not openable) or puts it back
 * up. Nothing is deleted. Needs migration 20261105060000 (books.active).
 */
export async function setBookActive(slug: string, active: boolean): Promise<ImportResult> {
  const owner = await ownerService();
  if ("error" in owner) return { ok: false, error: owner.error };
  const { data, error } = await owner.service
    .from("books")
    .update({ active: active === true })
    .eq("slug", String(slug))
    .select("id");
  if (error) return { ok: false, error: missingColumn(error) ? "migrationPending" : "failed" };
  if (!data || data.length === 0) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true };
}
