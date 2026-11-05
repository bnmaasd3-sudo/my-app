"use client";

import { SlidersHorizontal } from "lucide-react";
import { useActionState, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { readerChapters, setChapterOverride, type OverrideState, type ReaderChapter } from "./actions";

type Labels = Dictionary["admin"]["overrides"];

const smallButton = "rounded-full border border-border px-3 py-1 text-xs hover:bg-background disabled:opacity-60";
const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

/**
 * One reader's copy of one shared book: which chapters they see and which
 * have their own text. The list loads when the owner opens it.
 */
export function ChapterOverrides({
  readerId,
  book,
  labels,
}: {
  readerId: string;
  book: { slug: string; title: string; hidden?: number; replaced?: number };
  labels: Labels;
}) {
  const [chapters, setChapters] = useState<ReaderChapter[] | "loading" | "error" | null>(null);

  const load = async () => {
    setChapters("loading");
    setChapters((await readerChapters(readerId, book.slug)) ?? "error");
  };

  return (
    <details
      className="rounded-xl border border-border"
      onToggle={(event) => {
        if (event.currentTarget.open && (chapters === null || chapters === "error")) void load();
      }}
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
        <SlidersHorizontal size={14} aria-hidden className="shrink-0 text-accent" />
        <span className="font-medium">{labels.open}</span>
        <span>{book.title}</span>
        {!!book.hidden && <span className="text-xs text-muted">{format(labels.hiddenCount, { n: book.hidden })}</span>}
        {!!book.replaced && (
          <span className="text-xs text-muted">{format(labels.replacedCount, { n: book.replaced })}</span>
        )}
      </summary>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <p className="text-xs leading-relaxed text-muted">{labels.lead}</p>
        {chapters === "loading" && <p className="text-sm text-muted">{labels.loading}</p>}
        {chapters === "error" && <p className="text-sm text-muted">{labels.loadError}</p>}
        {Array.isArray(chapters) &&
          chapters.map((chapter, index) => (
            <OverrideRow
              key={chapter.position}
              readerId={readerId}
              bookSlug={book.slug}
              chapter={chapter}
              first={index === 0}
              labels={labels}
            />
          ))}
        <p className="text-xs leading-relaxed text-muted">{labels.edition}</p>
      </div>
    </details>
  );
}

function OverrideRow({
  readerId,
  bookSlug,
  chapter,
  first,
  labels,
}: {
  readerId: string;
  bookSlug: string;
  chapter: ReaderChapter;
  /** The book's first chapter carries the support line, so it always stays. */
  first: boolean;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(setChapterOverride, { status: "idle" } as OverrideState);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg bg-background p-3">
      <input type="hidden" name="reader" value={readerId} />
      <input type="hidden" name="book" value={bookSlug} />
      <input type="hidden" name="position" value={chapter.position} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-heading text-xs tabular-nums text-muted">{chapter.position}</span>
        <span dir="auto" className="min-w-0 flex-1 text-sm">
          {chapter.title}
        </span>
        {first ? (
          <span className="text-xs text-muted">
            <input type="hidden" name="shown" value="on" />
            {labels.firstStays}
          </span>
        ) : (
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="shown" defaultChecked={!chapter.hidden} className="accent-accent" />
            {labels.shown}
          </label>
        )}
      </div>
      <details open={!!chapter.body_override}>
        <summary className="cursor-pointer text-xs text-accent">{labels.replace}</summary>
        <textarea
          name="body"
          defaultValue={chapter.body_override ?? ""}
          rows={6}
          dir="auto"
          aria-label={labels.replace}
          className={`${field} mt-2 font-mono`}
        />
        <p className="mt-1 text-xs text-muted">{first ? labels.replaceHintFirst : labels.replaceHint}</p>
      </details>
      <input
        name="note"
        defaultValue={chapter.note ?? ""}
        maxLength={500}
        placeholder={labels.note}
        aria-label={labels.note}
        className={field}
      />
      <div className="flex items-center gap-2">
        <button disabled={pending} className={smallButton}>
          {pending ? labels.saving : labels.save}
        </button>
        <span role="status" className="text-xs text-muted">
          {state.status === "saved" && labels.saved}
          {state.status === "error" &&
            (state.error === "supportLine"
              ? labels.supportLine
              : state.error === "firstChapter"
                ? labels.firstStays
                : labels.failed)}
        </span>
      </div>
    </form>
  );
}
