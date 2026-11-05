// Pure helpers for scripts/import-book.mjs (tested in book-import.test.mjs).

export const SUPPORT_LINE =
  "الدعم في السعودية: 937 (وزارة الصحة) | الطوارئ: 911 | الهلال الأحمر: 997";

// Western, Arabic-Indic and Persian digits, and both percent signs.
const FORBIDDEN = /[0-9٠-٩۰-۹%٪]/;

const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Turns source files into ordered chapters. One file per chapter; a single
 * file is split at each "# " heading instead, or at each "## " heading when it
 * has fewer than two "# " headings.
 * @param {{ name: string, text: string }[]} files
 */
export function toChapters(files) {
  const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name));
  const sources =
    sorted.length === 1 ? splitAtHeadings(sorted[0]) : sorted.map((file) => parseFile(file));
  return sources
    .filter((chapter) => chapter.body.trim() !== "")
    .map((chapter, index) => ({ ...chapter, position: index + 1 }));
}

// Without a "# " heading the title comes from the file name, minus the
// ordering number ("03-الصمت.md" -> "الصمت").
const titleFromName = (name) =>
  name.replace(/\.[^.]+$/, "").replace(/^[\d٠-٩۰-۹\s._-]+/, "").trim();

function parseFile({ name, text }, source = name) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  // The title is the first line when it is a "# " or "## " heading.
  const match = /^#{1,2}\s+(.+)\n?/.exec(normalized);
  return {
    source,
    title: match ? match[1].trim() : titleFromName(name),
    body: match ? normalized.slice(match[0].length).trim() : normalized,
  };
}

function splitAtHeadings({ name, text }) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const level = (normalized.match(/^#\s/gm) ?? []).length >= 2 ? "#" : "##";
  const heading = new RegExp(`^${level}\\s`);
  const parts = normalized.split(new RegExp(`^(?=${level}\\s)`, "m")).filter((part) => part.trim() !== "");
  // Text before the first heading (the support line) opens the first chapter.
  if (parts.length > 1 && !heading.test(parts[0])) {
    // Split at "## ", a "# " line before the first chapter is the book's own title.
    const preamble = parts
      .shift()
      .replace(level === "##" ? /^#\s.*$/m : /$^/, "")
      .trim();
    const [heading, ...rest] = parts[0].split("\n");
    parts[0] = [heading, preamble, "", ...rest].join("\n");
  }
  return parts.map((part, index) => parseFile({ name, text: part }, `${name} § ${index + 1}`));
}

/**
 * Puts the support line at the start of the first chapter when the book does
 * not carry it anywhere. Returns the chapters and whether the line was added.
 * (A book that has it in the wrong place is left for checkChapters to refuse.)
 */
export function withSupportLine(chapters) {
  if (chapters.length === 0 || chapters.some((chapter) => chapter.body.includes(SUPPORT_LINE))) {
    return { chapters, added: false };
  }
  const [first, ...rest] = chapters;
  return { chapters: [{ ...first, body: `${SUPPORT_LINE}\n\n${first.body}` }, ...rest], added: true };
}

/**
 * The support-line rule for one chapter on its own, for checks that see a
 * chapter at a time: the first chapter opens with it once, no other has it.
 */
export function supportLineProblem(position, body) {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const count = lines.filter((line) => line.includes(SUPPORT_LINE)).length;
  if (position === 1) {
    const firstLine = lines.find((line) => line.trim() !== "")?.trim();
    return firstLine === SUPPORT_LINE && count === 1 ? null : "support-line";
  }
  return count === 0 ? null : "support-line";
}

export const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

/**
 * Checks the house rules: the support line opens the first chapter and
 * appears nowhere else, and the text has no digits or percent signs.
 * Returns a list of problems. Problems marked `warning` are for the author to
 * review; any other problem stops the import.
 */
export function checkChapters(chapters) {
  const problems = [];
  if (chapters.length === 0) problems.push({ kind: "empty", message: "No chapters found." });

  chapters.forEach((chapter, index) => {
    const lines = chapter.body.split("\n");
    const firstLine = lines.find((line) => line.trim() !== "")?.trim();
    const supportCount = lines.filter((line) => line.includes(SUPPORT_LINE)).length;

    if (index === 0 && firstLine !== SUPPORT_LINE) {
      problems.push({
        kind: "support-line",
        chapter: chapter.position,
        message: "The first chapter must open with the exact support line.",
      });
    }
    if (chapter.title === "") {
      problems.push({
        kind: "title",
        chapter: chapter.position,
        message: `${chapter.source} has no "# " heading to use as its title.`,
      });
    }
    if (supportCount > (index === 0 ? 1 : 0)) {
      problems.push({
        kind: "support-line",
        chapter: chapter.position,
        message: "The support line may appear once, at the start of the book only.",
      });
    }

    for (const [label, text] of [["title", chapter.title], ...lines.map((l, i) => [`line ${i + 1}`, l])]) {
      const checked = text.split(SUPPORT_LINE).join("");
      if (FORBIDDEN.test(checked)) {
        problems.push({
          kind: "digits",
          // Symbols such as S1–S5 or A1–A5, list numbers and figure paths are
          // legitimate, so digits are reported for review, not refused.
          warning: true,
          chapter: chapter.position,
          message: `${chapter.source} ${label}: ${text.trim().slice(0, 120)}`,
        });
      }
    }
  });
  return problems;
}

/** Picks a dollar-quote tag that does not occur in any of the texts. */
function dollarTag(texts) {
  for (let i = 0; ; i++) {
    const tag = `$qari${i}$`;
    if (!texts.some((text) => text.includes(tag))) return tag;
  }
}

export const BOOK_KINDS = ["encyclopedia", "novel", "appendix"];

/**
 * Throws on a slug, language, type or kind the database would refuse.
 * @param {{ slug: string, lang: string, typeCode?: string | null, kind?: string }} meta
 */
export function checkBookMeta({ slug, lang, typeCode = null, kind = "encyclopedia" }) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (!["ar", "en"].includes(lang)) throw new Error(`Invalid lang: ${lang}`);
  if (typeCode !== null && !/^[A-Z]{4}(-[A-Z]){0,2}$/.test(typeCode)) throw new Error(`Invalid type: ${typeCode}`);
  if (!BOOK_KINDS.includes(kind)) throw new Error(`Invalid kind: ${kind}`);
}

/**
 * One transaction that adds the book and its chapters. It refuses to touch an
 * existing book: a new edition is imported under a new slug.
 */
export function toSql({ slug, title, lang, typeCode = null, kind = "encyclopedia" }, chapters) {
  checkBookMeta({ slug, lang, typeCode, kind });
  const q = dollarTag([title, ...chapters.flatMap((c) => [c.title, c.body])]);
  const quote = (text) => `${q}${text}${q}`;

  const rows = chapters
    .map((c) => `  ((select id from new_book), ${c.position}, ${quote(c.title)}, ${quote(c.body)})`)
    .join(",\n");

  return `begin;
do $check$ begin
  if exists (select 1 from public.books where slug = '${slug}') then
    raise exception 'book % already exists', '${slug}';
  end if;
end $check$;
with new_book as (
  insert into public.books (slug, title, lang, type_code, kind)
  values ('${slug}', ${quote(title)}, '${lang}', ${typeCode ? `'${typeCode}'` : "null"}, '${kind}')
  returning id
)
insert into public.chapters (book_id, position, title, body) values
${rows};
commit;
`;
}
