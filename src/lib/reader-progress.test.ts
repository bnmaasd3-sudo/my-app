import { describe, expect, it } from "vitest";
import { bookProgress, daysAgo, latest, matchesSearch, type ChapterRef } from "./reader-progress";

const chapters: ChapterRef[] = [1, 2, 3, 4].map((position) => ({
  id: `c${position}`,
  book_id: "b",
  position,
  title: `Chapter ${position}`,
}));

describe("bookProgress", () => {
  it("places the reader among the chapters, in order", () => {
    expect(bookProgress([...chapters].reverse(), new Set(), "c3")).toEqual({
      index: 3,
      total: 4,
      percent: 75,
      title: "Chapter 3",
    });
  });

  it("leaves out chapters hidden for that reader", () => {
    expect(bookProgress(chapters, new Set(["c2"]), "c3")).toEqual({ index: 2, total: 3, percent: 67, title: "Chapter 3" });
  });

  it("reports a reader who has not started, or whose place was hidden later", () => {
    expect(bookProgress(chapters, new Set(), null)).toEqual({ index: null, total: 4, percent: 0, title: null });
    expect(bookProgress(chapters, new Set(["c3"]), "c3")).toMatchObject({ index: null, total: 3, percent: 0 });
  });
});

describe("helpers", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  it("counts whole days", () => {
    expect(daysAgo("2026-11-05T01:00:00Z", now)).toBe(0);
    expect(daysAgo("2026-11-04T11:00:00Z", now)).toBe(1);
    expect(daysAgo("2026-11-01T12:00:00Z", now)).toBe(4);
    expect(daysAgo("2026-11-06T12:00:00Z", now)).toBe(0);
  });

  it("finds the latest moment", () => {
    expect(latest(null, "2026-11-01T00:00:00Z", undefined, "2026-11-03T00:00:00Z")).toBe("2026-11-03T00:00:00Z");
    expect(latest(null, undefined)).toBeNull();
  });

  it("searches name and email", () => {
    const reader = { name: "نورة", email: "Noura@Example.com" };
    expect(matchesSearch(reader, "  noura ")).toBe(true);
    expect(matchesSearch(reader, "نور")).toBe(true);
    expect(matchesSearch(reader, "sara")).toBe(false);
    expect(matchesSearch({ name: null, email: "a@b.c" }, "")).toBe(true);
  });
});
