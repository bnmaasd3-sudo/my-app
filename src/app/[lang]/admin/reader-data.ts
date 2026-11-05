import "server-only";
import { bookProgress, type BookProgress, type ChapterRef } from "@/lib/reader-progress";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * The service client, for the owner only. Reading progress lives in tables
 * no account can read (reading_state, reading_log, chapters...), so the owner's
 * views read them with the service key, after is_admin on their own session.
 */
export async function ownerService(): Promise<{ service: Service } | { error: "notOwner" | "noServiceKey" }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: "notOwner" };
  const service = createServiceClient();
  return service ? { service } : { error: "noServiceKey" };
}

export type ReaderBookProgress = BookProgress & { updatedAt: string | null };
/** Progress by reader id, then by book slug. */
export type ProgressByReader = Record<string, Record<string, ReaderBookProgress>>;

async function chaptersByBook(service: Service, bookIds?: string[]) {
  let query = service.from("chapters").select("id, book_id, position, title");
  if (bookIds) query = query.in("book_id", bookIds);
  const { data } = await query;
  const byBook = new Map<string, ChapterRef[]>();
  for (const chapter of (data ?? []) as ChapterRef[]) {
    byBook.set(chapter.book_id, [...(byBook.get(chapter.book_id) ?? []), chapter]);
  }
  return byBook;
}

async function hiddenByReader(service: Service, readerIds: string[]) {
  const { data } = await service
    .from("reader_chapter_overrides")
    .select("reader_id, chapter_id")
    .in("reader_id", readerIds)
    .eq("hidden", true);
  const byReader = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { reader_id: string; chapter_id: string }[]) {
    byReader.set(row.reader_id, (byReader.get(row.reader_id) ?? new Set()).add(row.chapter_id));
  }
  return byReader;
}

/** Where each reader is in each book they have read, for the readers list. */
export async function loadProgress(service: Service, readerIds: string[]): Promise<ProgressByReader> {
  if (readerIds.length === 0) return {};
  const [books, chapters, hidden, states] = await Promise.all([
    service.from("books").select("id, slug"),
    chaptersByBook(service),
    hiddenByReader(service, readerIds),
    service.from("reading_state").select("reader_id, book_id, chapter_id, updated_at").in("reader_id", readerIds),
  ]);
  const slugs = new Map(((books.data ?? []) as { id: string; slug: string }[]).map((book) => [book.id, book.slug]));
  const result: ProgressByReader = {};
  for (const state of (states.data ?? []) as {
    reader_id: string;
    book_id: string;
    chapter_id: string | null;
    updated_at: string;
  }[]) {
    const slug = slugs.get(state.book_id);
    if (!slug) continue;
    result[state.reader_id] ??= {};
    result[state.reader_id][slug] = {
      ...bookProgress(chapters.get(state.book_id) ?? [], hidden.get(state.reader_id) ?? new Set(), state.chapter_id),
      updatedAt: state.updated_at,
    };
  }
  return result;
}

export type ReaderDetail = {
  reader: { id: string; email: string; name: string | null; active: boolean; createdAt: string };
  lastSignIn: string | null;
  devices: { id: string; firstSeen: string; lastSeen: string; revoked: boolean }[];
  books: {
    slug: string;
    title: string;
    lang: string;
    active: boolean;
    source: string;
    progress: ReaderBookProgress;
    opened: number;
    firstOpened: string | null;
    lastOpened: string | null;
  }[];
  timeline: { at: string; book: string; chapter: string; position: number }[];
  tests: { key: string; status: string | null; name: string | null; updatedAt: string }[];
};

/** Everything the owner sees about one reader. Null when there is no such reader. */
export async function loadReaderDetail(service: Service, readerId: string): Promise<ReaderDetail | null> {
  const { data: reader } = await service
    .from("readers")
    .select("id, email, display_name, active, created_at")
    .eq("id", readerId)
    .maybeSingle();
  if (!reader) return null;

  const [user, devices, entitlements, states, logs, tests, hidden] = await Promise.all([
    service.auth.admin.getUserById(readerId),
    service.from("devices").select("device_id, first_seen, last_seen, revoked").eq("reader_id", readerId),
    service.from("entitlements").select("book_id, active, source, books(slug, title, lang)").eq("reader_id", readerId),
    service.from("reading_state").select("book_id, chapter_id, updated_at").eq("reader_id", readerId),
    service
      .from("reading_log")
      .select("chapter_id, opened_at")
      .eq("reader_id", readerId)
      .order("opened_at", { ascending: false })
      .limit(5000),
    service
      .from("test_results")
      .select("key, updated_at, status:answers->>status, name:answers->>name")
      .eq("user_id", readerId)
      .order("updated_at", { ascending: false }),
    hiddenByReader(service, [readerId]),
  ]);

  type Entitlement = {
    book_id: string;
    active: boolean;
    source: string;
    books: { slug: string; title: string; lang: string } | null;
  };
  const owned = ((entitlements.data ?? []) as unknown as Entitlement[]).filter((e) => e.books);
  const chapters = await chaptersByBook(
    service,
    owned.map((e) => e.book_id),
  );
  const chapterById = new Map<string, ChapterRef>();
  for (const list of chapters.values()) for (const chapter of list) chapterById.set(chapter.id, chapter);

  const stateByBook = new Map(
    ((states.data ?? []) as { book_id: string; chapter_id: string | null; updated_at: string }[]).map((s) => [
      s.book_id,
      s,
    ]),
  );
  const logRows = (logs.data ?? []) as { chapter_id: string; opened_at: string }[];
  const hiddenSet = hidden.get(readerId) ?? new Set<string>();
  const titleByBook = new Map(owned.map((e) => [e.book_id, e.books!.title]));

  return {
    reader: {
      id: reader.id,
      email: reader.email,
      name: reader.display_name,
      active: reader.active,
      createdAt: reader.created_at,
    },
    lastSignIn: user.data?.user?.last_sign_in_at ?? null,
    devices: ((devices.data ?? []) as { device_id: string; first_seen: string; last_seen: string; revoked: boolean }[])
      .map((d) => ({ id: d.device_id, firstSeen: d.first_seen, lastSeen: d.last_seen, revoked: d.revoked }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    books: owned.map((e) => {
      const bookChapters = chapters.get(e.book_id) ?? [];
      const ids = new Set(bookChapters.map((c) => c.id));
      const bookLogs = logRows.filter((log) => ids.has(log.chapter_id));
      const state = stateByBook.get(e.book_id);
      return {
        slug: e.books!.slug,
        title: e.books!.title,
        lang: e.books!.lang,
        active: e.active,
        source: e.source,
        progress: {
          ...bookProgress(bookChapters, hiddenSet, state?.chapter_id ?? null),
          updatedAt: state?.updated_at ?? null,
        },
        opened: new Set(bookLogs.filter((log) => !hiddenSet.has(log.chapter_id)).map((log) => log.chapter_id)).size,
        firstOpened: bookLogs.at(-1)?.opened_at ?? null,
        lastOpened: bookLogs[0]?.opened_at ?? null,
      };
    }),
    // What the reader actually opened, newest first: books they still have,
    // chapters hidden since included (it is a record of reading, not the contents).
    timeline: logRows
      .flatMap((log) => {
        const chapter = chapterById.get(log.chapter_id);
        return chapter
          ? [{ at: log.opened_at, book: titleByBook.get(chapter.book_id) ?? "", chapter: chapter.title, position: chapter.position }]
          : [];
      })
      .slice(0, 50),
    tests: ((tests.data ?? []) as { key: string; updated_at: string; status: string | null; name: string | null }[]).map(
      (t) => ({ key: t.key, status: t.status, name: t.name, updatedAt: t.updated_at }),
    ),
  };
}
