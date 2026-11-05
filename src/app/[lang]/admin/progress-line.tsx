import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { daysAgo, type BookProgress } from "@/lib/reader-progress";

type Labels = Dictionary["admin"]["follow"];

/** "today", "yesterday" or "n days ago". */
export function relativeDay(iso: string, labels: Labels) {
  const days = daysAgo(iso);
  return days === 0 ? labels.today : days === 1 ? labels.yesterday : format(labels.daysAgo, { n: days });
}

/** «الفصل 7 من 33 · آخر قراءة قبل يومين» and a thin bar under it. */
export function ProgressLine({
  progress,
  updatedAt,
  labels,
}: {
  progress: BookProgress | undefined;
  updatedAt: string | null | undefined;
  labels: Labels;
}) {
  const started = progress?.index != null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted">
        {started ? format(labels.chapterOf, { n: progress!.index!, total: progress!.total }) : labels.notStarted}
        {updatedAt && started && ` · ${format(labels.lastRead, { when: relativeDay(updatedAt, labels) })}`}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress?.percent ?? 0}
        className="h-0.5 w-full max-w-xs bg-border"
      >
        <div className="h-full bg-accent" style={{ width: `${progress?.percent ?? 0}%` }} />
      </div>
    </div>
  );
}
