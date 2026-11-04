#!/usr/bin/env node
// Checks a book's chapter files and writes the SQL that imports it.
// See .claude/skills/import-book/SKILL.md.
//
//   node scripts/import-book.mjs --dir <chapters folder> --slug infj-t-h-reader \
//     --title "<book title>" [--lang ar] [--type INFJ-T-H] [--kind encyclopedia|novel|appendix]
//     [--out <file.sql>] [--strict]
//
// --type and --kind place the book in its type's card in the library.
//
// Without --out it only prints the report. The SQL file holds the book text,
// so write it outside the repository and never commit it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checkChapters, countWords, toChapters, toSql } from "./lib/book-import.mjs";

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    slug: { type: "string" },
    title: { type: "string" },
    lang: { type: "string", default: "ar" },
    type: { type: "string" },
    kind: { type: "string", default: "encyclopedia" },
    out: { type: "string" },
    strict: { type: "boolean", default: false },
  },
});

if (!values.dir || !values.slug || !values.title) {
  console.error(
    "Usage: --dir <folder> --slug <slug> --title <title> [--lang ar|en] [--type INFJ-T-H] [--kind encyclopedia|novel|appendix] [--out file.sql]",
  );
  process.exit(2);
}

const files = readdirSync(values.dir)
  .filter((name) => /\.(md|markdown|txt)$/i.test(name))
  .map((name) => ({ name, text: readFileSync(join(values.dir, name), "utf8") }));

const chapters = toChapters(files);

console.log(`Book: ${values.title} (${values.slug}, ${values.lang})`);
console.table(
  chapters.map((c) => ({ chapter: c.position, title: c.title, words: countWords(c.body), source: c.source })),
);
console.log(`Total words: ${chapters.reduce((sum, c) => sum + countWords(c.body), 0)}`);

const problems = checkChapters(chapters);
const warnings = problems.filter((p) => p.warning);
const errors = values.strict ? problems : problems.filter((p) => !p.warning);
for (const p of warnings) console.warn(`- [${p.kind}, review] chapter ${p.chapter}: ${p.message}`);
if (warnings.length > 0) console.warn(`${warnings.length} line(s) with digits to review (use --strict to refuse them).`);
if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s). Nothing was written; fix the text with its author first.`);
  for (const p of errors) console.error(`- [${p.kind}] chapter ${p.chapter ?? "-"}: ${p.message}`);
  process.exit(1);
}
console.log("\nChecks passed: the support line opens the book and appears nowhere else.");

if (values.out) {
  const out = resolve(values.out);
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  if ((out + sep).startsWith(resolve(repoRoot) + sep)) {
    console.error("Refusing to write book text inside the repository. Choose a path outside it.");
    process.exit(2);
  }
  writeFileSync(out, toSql(
      { slug: values.slug, title: values.title, lang: values.lang, typeCode: values.type ?? null, kind: values.kind },
      chapters,
    ));
  console.log(`SQL written to ${out}. Run it once in the Supabase SQL editor (or execute_sql).`);
}
