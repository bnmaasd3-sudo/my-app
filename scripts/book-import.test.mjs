import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  SUPPORT_LINE,
  checkChapters,
  countWords,
  supportLineProblem,
  toChapters,
  toSql,
  withSupportLine,
} from "./lib/book-import.mjs";

const file = (name, text) => ({ name, text });

describe("toChapters", () => {
  it("orders files naturally and takes titles from the first heading", () => {
    const chapters = toChapters([
      file("10-end.md", "# الخاتمة\nنص"),
      file("2-two.md", "# الثاني\nنص"),
      file("1-one.md", `# الأول\n${SUPPORT_LINE}\n\nنص`),
    ]);
    expect(chapters.map((c) => [c.position, c.title])).toEqual([
      [1, "الأول"],
      [2, "الثاني"],
      [3, "الخاتمة"],
    ]);
    expect(chapters[0].body.startsWith(SUPPORT_LINE)).toBe(true);
  });

  it("keeps text before the first heading at the start of the first chapter", () => {
    const chapters = toChapters([file("book.md", `${SUPPORT_LINE}\n\n# الأول\nنص\n# الثاني\nنص`)]);
    expect(chapters.map((c) => c.title)).toEqual(["الأول", "الثاني"]);
    expect(checkChapters(chapters)).toEqual([]);
  });

  it("takes the title from the file name without its ordering number", () => {
    const chapters = toChapters([file("01-المقدمة.md", `${SUPPORT_LINE}\n\nنص`), file("02.md", "نص")]);
    expect(chapters.map((c) => c.title)).toEqual(["المقدمة", ""]);
    expect(checkChapters(chapters).map((p) => p.kind)).toEqual(["title"]);
  });

  it("splits a single file at top-level headings", () => {
    const chapters = toChapters([file("book.md", "# أ\nنص أ\n## فرعي\nتابع\n# ب\nنص ب")]);
    expect(chapters.map((c) => c.title)).toEqual(["أ", "ب"]);
    expect(chapters[0].body).toContain("## فرعي");
  });
});

describe("checkChapters", () => {
  const good = () =>
    toChapters([file("1.md", `# أ\n${SUPPORT_LINE}\n\nنص بلا أرقام`), file("2.md", "# ب\nنص")]);

  it("passes a clean book", () => {
    expect(checkChapters(good())).toEqual([]);
  });

  it("requires the support line at the start of the first chapter", () => {
    const chapters = toChapters([file("1.md", "# أ\nنص"), file("2.md", "# ب\nنص")]);
    expect(checkChapters(chapters).map((p) => p.kind)).toEqual(["support-line"]);
  });

  it("refuses the support line anywhere else", () => {
    const chapters = good();
    chapters[1].body += `\n${SUPPORT_LINE}`;
    expect(checkChapters(chapters).map((p) => p.kind)).toEqual(["support-line"]);
  });

  it("flags every kind of digit and percent sign", () => {
    for (const bad of ["سنة 2020", "سنة ٢٠٢٠", "سنة ۲۰۲۰", "نصف ٪", "half %"]) {
      const chapters = good();
      chapters[1].body = bad;
      expect(checkChapters(chapters).map((p) => [p.kind, p.warning])).toEqual([["digits", true]]);
    }
  });

  it("counts words", () => {
    expect(countWords("  كلمة  وأخرى\nثالثة ")).toBe(3);
  });
});

describe("toSql", () => {
  it("imports the book in one transaction and refuses to overwrite it", async () => {
    const db = new PGlite();
    await db.exec(`
      create table public.books (id uuid primary key default gen_random_uuid(), slug text unique, title text, lang text, type_code text, kind text);
      create table public.chapters (book_id uuid references public.books(id), position int, title text, body text);
    `);
    const chapters = toChapters([
      file("1.md", `# أ\n${SUPPORT_LINE}\n\nفيه $$ و $qari0$ و 'اقتباس'`),
      file("2.md", "# ب\nنص"),
    ]);
    const sql = toSql({ slug: "infj-t-h-reader", title: "كتاب 'INFJ'", lang: "ar" }, chapters);

    await db.exec(sql);
    const rows = await db.query("select position, body from public.chapters order by position");
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].body).toContain("$qari0$ و 'اقتباس'");

    await expect(db.exec(sql)).rejects.toThrow(/already exists/);
    await db.exec("rollback");
    const count = await db.query("select count(*)::int as n from public.chapters");
    expect(count.rows[0].n).toBe(2);
  }, 30_000); // PGlite starts a whole Postgres; allow for a busy machine.

  it("rejects unsafe slugs", () => {
    expect(() => toSql({ slug: "x'; drop", title: "t", lang: "ar" }, [])).toThrow(/Invalid slug/);
    expect(() => toSql({ slug: "x", title: "t", lang: "ar", typeCode: "infj'" }, [])).toThrow(/Invalid type/);
    expect(() => toSql({ slug: "x", title: "t", lang: "ar", kind: "poem" }, [])).toThrow(/Invalid kind/);
  });
});

describe("toSql with a type", () => {
  it("files the book under its type and kind", () => {
    const sql = toSql({ slug: "infj-t-h-novel", title: "رواية", lang: "ar", typeCode: "INFJ-T-H", kind: "novel" }, []);
    expect(sql).toContain("insert into public.books (slug, title, lang, type_code, kind)");
    expect(sql).toContain("'ar', 'INFJ-T-H', 'novel')");
  });
});

describe("one file split at second-level headings", () => {
  it("splits at \"## \" when the file has fewer than two \"# \" headings", () => {
    const chapters = toChapters([file("book.md", `# الكتاب\n${SUPPORT_LINE}\n\n## أ\nنص أ\n## ب\nنص ب`)]);
    expect(chapters.map((c) => c.title)).toEqual(["أ", "ب"]);
    // The book's own "# " title is dropped; the support line opens chapter one.
    expect(chapters[0].body).toBe(`${SUPPORT_LINE}\n\nنص أ`);
  });

  it("takes a \"## \" first line as the title of a chapter file", () => {
    const chapters = toChapters([file("1.md", "## أ\nنص"), file("2.md", "## ب\nنص")]);
    expect(chapters.map((c) => [c.title, c.body])).toEqual([["أ", "نص"], ["ب", "نص"]]);
  });
});

describe("support line", () => {
  it("adds it to the first chapter when the book lacks it", () => {
    const { chapters, added } = withSupportLine([{ position: 1, title: "أ", body: "نص", source: "1" }]);
    expect(added).toBe(true);
    expect(checkChapters(chapters).filter((p) => !p.warning)).toEqual([]);
  });

  it("leaves a book that already carries it", () => {
    const book = [{ position: 1, title: "أ", body: `${SUPPORT_LINE}\n\nنص`, source: "1" }];
    expect(withSupportLine(book)).toEqual({ chapters: book, added: false });
  });

  it("checks one chapter at a time", () => {
    expect(supportLineProblem(1, `\n${SUPPORT_LINE}\n\nنص`)).toBeNull();
    expect(supportLineProblem(1, "نص")).toBe("support-line");
    expect(supportLineProblem(1, `${SUPPORT_LINE}\n${SUPPORT_LINE}`)).toBe("support-line");
    expect(supportLineProblem(2, "نص")).toBeNull();
    expect(supportLineProblem(2, `نص\n${SUPPORT_LINE}`)).toBe("support-line");
  });
});
