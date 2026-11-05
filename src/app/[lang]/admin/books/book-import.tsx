"use client";

import { useMemo, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import {
  BOOK_KINDS,
  FIGURE_NAME,
  MAX_CHAPTER,
  MAX_FIGURE,
  checkChapters,
  countWords,
  suggestedSlug,
  toChapters,
  withSupportLine,
  type ImportedChapter,
} from "@/lib/book-import";
import { prepareBook, saveChapters, uploadFigure, type BookMeta, type ImportResult } from "./actions";

type Labels = Dictionary["admin"]["bookImport"];
type Kind = BookMeta["kind"];

export type ExistingBook = {
  slug: string;
  title: string;
  lang: string;
  typeCode: string | null;
  kind: string;
  chapters: number;
};

type Problem = { kind: string; chapter?: number; warning?: boolean; message: string };

const field = "w-full rounded-xl border border-transparent bg-surface px-4 py-2.5 outline-none focus:border-accent";
const button =
  "self-start rounded-xl bg-accent px-6 py-2.5 font-heading text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
/** Chapters sent per call, kept well under the server action body limit. */
const BATCH_CHARS = 2_000_000;

export function BookImport({
  books,
  labels,
  kinds,
}: {
  books: ExistingBook[];
  labels: Labels;
  kinds: Dictionary["library"]["kinds"];
}) {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{labels.current}</h2>
        {books.length === 0 ? (
          <p className="text-muted">{labels.noBooks}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border text-sm">
            {books.map((book) => (
              <li key={book.slug} className="flex flex-wrap items-baseline gap-x-3 py-3">
                <span className="font-medium">{book.title}</span>
                <span dir="ltr" className="text-muted">
                  {book.slug}
                </span>
                <span className="text-muted">
                  {book.typeCode ?? ""} · {kinds[book.kind as Kind] ?? book.kind} · {book.chapters}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ChapterImport books={books} labels={labels} kinds={kinds} />
      <FigureUpload books={books} labels={labels} />
    </div>
  );
}

function errorText(labels: Labels, result: Extract<ImportResult, { ok: false }>) {
  const prefix = result.position ? format(labels.chapterError, { n: result.position }) : "";
  return prefix + labels.errors[result.error];
}

function ChapterImport({
  books,
  labels,
  kinds,
}: {
  books: ExistingBook[];
  labels: Labels;
  kinds: Dictionary["library"]["kinds"];
}) {
  const [mode, setMode] = useState<"new" | "update">("new");
  const [existing, setExisting] = useState(books[0]?.slug ?? "");
  const [typeCode, setTypeCode] = useState("");
  const [kind, setKind] = useState<Kind>("encyclopedia");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [chapters, setChapters] = useState<ImportedChapter[]>([]);
  const [supportAdded, setSupportAdded] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "done" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });

  const chosen = books.find((book) => book.slug === existing);
  const finalSlug = mode === "update" ? existing : slugEdited ? slug : suggestedSlug(typeCode, kind);

  const choose = (slugToUse: string) => {
    setExisting(slugToUse);
    const book = books.find((b) => b.slug === slugToUse);
    if (!book) return;
    setTypeCode(book.typeCode ?? "");
    setKind((BOOK_KINDS as string[]).includes(book.kind) ? (book.kind as Kind) : "encyclopedia");
    setTitle(book.title);
    setLang(book.lang === "en" ? "en" : "ar");
  };

  const readFiles = async (list: FileList | null) => {
    setStatus({ kind: "idle", text: "" });
    if (!list || list.length === 0) return setChapters([]);
    const files = await Promise.all([...list].map(async (file) => ({ name: file.name, text: await file.text() })));
    const parsed = toChapters(files) as ImportedChapter[];
    const { chapters: withLine, added } = withSupportLine(parsed) as { chapters: ImportedChapter[]; added: boolean };
    setChapters(withLine);
    setSupportAdded(added);
  };

  const problems = useMemo(() => {
    const list = checkChapters(chapters) as Problem[];
    if (chapters.length > 0 && chapters.some((chapter) => chapter.body.length > MAX_CHAPTER)) {
      list.push({ kind: "tooLarge", message: "" });
    }
    if (chapters.length === 0) return [];
    return list;
  }, [chapters]);
  const blocking = problems.filter((problem) => !problem.warning);
  const warningsByChapter = new Map<number, number>();
  for (const problem of problems) {
    if (problem.warning && problem.chapter) {
      warningsByChapter.set(problem.chapter, (warningsByChapter.get(problem.chapter) ?? 0) + 1);
    }
  }

  const publish = async () => {
    const meta: BookMeta = { slug: finalSlug, title, lang, typeCode: typeCode.trim() || null, kind };
    setStatus({ kind: "busy", text: format(labels.publishing, { done: 0, total: chapters.length }) });
    const prepared = await prepareBook(meta, chapters.length);
    if (!prepared.ok) return setStatus({ kind: "error", text: errorText(labels, prepared) });

    let batch: ImportedChapter[] = [];
    let size = 0;
    let done = 0;
    const flush = async () => {
      if (batch.length === 0) return true;
      const result = await saveChapters(
        finalSlug,
        batch.map(({ position, title: chapterTitle, body }) => ({ position, title: chapterTitle, body })),
      );
      if (!result.ok) {
        setStatus({ kind: "error", text: errorText(labels, result) });
        return false;
      }
      done += batch.length;
      setStatus({ kind: "busy", text: format(labels.publishing, { done, total: chapters.length }) });
      batch = [];
      size = 0;
      return true;
    };
    for (const chapter of chapters) {
      if (size + chapter.body.length > BATCH_CHARS && !(await flush())) return;
      batch.push(chapter);
      size += chapter.body.length;
    }
    if (!(await flush())) return;
    setStatus({ kind: "done", text: format(labels.published, { n: chapters.length }) });
  };

  const canPublish =
    chapters.length > 0 && blocking.length === 0 && title.trim() !== "" && finalSlug !== "" && status.kind !== "busy";

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-5 text-sm">
        {(["new", "update"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === value}
              disabled={value === "update" && books.length === 0}
              onChange={() => {
                setMode(value);
                if (value === "update") choose(existing || books[0]?.slug || "");
              }}
              className="accent-accent"
            />
            {value === "new" ? labels.newBook : labels.updateBook}
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "update" && (
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm text-muted">{labels.book}</span>
            <select value={existing} onChange={(event) => choose(event.target.value)} className={field}>
              {books.map((book) => (
                <option key={book.slug} value={book.slug}>
                  {book.title} ({book.slug})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{labels.typeCode}</span>
          <input
            dir="ltr"
            value={typeCode}
            onChange={(event) => setTypeCode(event.target.value.toUpperCase())}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{labels.kind}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as Kind)} className={field}>
            {(BOOK_KINDS as Kind[]).map((value) => (
              <option key={value} value={value}>
                {kinds[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{labels.titleLabel}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{labels.slug}</span>
          <input
            dir="ltr"
            value={finalSlug}
            readOnly={mode === "update"}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{labels.lang}</span>
          <select value={lang} onChange={(event) => setLang(event.target.value as "ar" | "en")} className={field}>
            <option value="ar">{labels.langs.ar}</option>
            <option value="en">{labels.langs.en}</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{labels.files}</span>
        <input
          type="file"
          multiple
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={(event) => void readFiles(event.target.files)}
          className="text-sm"
        />
        <span className="text-sm text-muted">{labels.filesHint}</span>
      </label>

      {chapters.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">{labels.preview}</h2>
          {supportAdded && <p className="text-sm text-accent">{labels.supportAdded}</p>}
          {blocking.length > 0 && (
            <div className="flex flex-col gap-1 text-sm text-accent" role="alert">
              <p>{labels.fix}</p>
              {[...new Set(blocking.map((problem) => problem.kind))].map((kindOfProblem) => (
                <p key={kindOfProblem}>{labels.problems[kindOfProblem as keyof Labels["problems"]] ?? kindOfProblem}</p>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pe-3 text-start font-normal">{labels.colPosition}</th>
                  <th className="py-2 pe-3 text-start font-normal">{labels.colTitle}</th>
                  <th className="py-2 pe-3 text-start font-normal">{labels.colWords}</th>
                  <th className="py-2 text-start font-normal">{labels.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((chapter) => {
                  const digits = warningsByChapter.get(chapter.position) ?? 0;
                  const errors = blocking.filter((problem) => problem.chapter === chapter.position);
                  return (
                    <tr key={chapter.position} className="border-b border-border align-top">
                      <td className="py-2 pe-3 tabular-nums">{chapter.position}</td>
                      <td dir="auto" className="py-2 pe-3">
                        {chapter.title}
                      </td>
                      <td className="py-2 pe-3 tabular-nums">{countWords(chapter.body)}</td>
                      <td className="py-2 text-muted">
                        {errors.map((problem) => (
                          <span key={problem.kind} className="block text-accent">
                            {labels.problems[problem.kind as keyof Labels["problems"]] ?? problem.message}
                          </span>
                        ))}
                        {digits > 0 && <span className="block">{format(labels.digits, { n: digits })}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "update" && chosen && chapters.length > 0 && chapters.length < chosen.chapters && (
        <p className="text-sm text-accent">{labels.errors.fewerChapters}</p>
      )}

      <button type="button" disabled={!canPublish} onClick={() => void publish()} className={button}>
        {mode === "update" ? labels.update : labels.publish}
      </button>
      {status.text && (
        <p role="status" className={status.kind === "error" ? "text-accent" : "text-muted"}>
          {status.text}
        </p>
      )}
    </section>
  );
}

function FigureUpload({ books, labels }: { books: ExistingBook[]; labels: Labels }) {
  const [slug, setSlug] = useState(books[0]?.slug ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (books.length === 0) return null;

  const upload = async () => {
    setBusy(true);
    const next: Record<string, string> = {};
    for (const file of files) {
      if (!FIGURE_NAME.test(file.name)) {
        next[file.name] = labels.errors.invalidFigure;
      } else if (file.size > MAX_FIGURE) {
        next[file.name] = labels.errors.tooLarge;
      } else {
        next[file.name] = labels.uploading;
        setResults({ ...next });
        const form = new FormData();
        form.set("slug", slug);
        form.set("file", file);
        const result = await uploadFigure(form);
        next[file.name] = result.ok ? labels.uploaded : labels.errors[result.error];
      }
      setResults({ ...next });
    }
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="font-heading text-lg font-semibold">{labels.figures}</h2>
      <p className="text-sm text-muted">{labels.figuresLead}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{labels.book}</span>
        <select value={slug} onChange={(event) => setSlug(event.target.value)} className={field}>
          {books.map((book) => (
            <option key={book.slug} value={book.slug}>
              {book.title} ({book.slug})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{labels.figureFiles}</span>
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={(event) => {
            setFiles([...(event.target.files ?? [])]);
            setResults({});
          }}
          className="text-sm"
        />
      </label>
      <button type="button" disabled={busy || files.length === 0} onClick={() => void upload()} className={button}>
        {busy ? labels.uploading : labels.upload}
      </button>
      {Object.keys(results).length > 0 && (
        <ul className="text-sm">
          {Object.entries(results).map(([name, text]) => (
            <li key={name} className="flex flex-wrap gap-x-3">
              <span dir="ltr">{name}</span>
              <span className="text-muted">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
