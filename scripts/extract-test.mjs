#!/usr/bin/env node
// Moves the type test from its standalone HTML page into the app, mechanically:
//
//   node scripts/extract-test.mjs <test.html>
//
// - Every top-level constant whose value is plain data (objects, arrays,
//   strings, numbers) is written to src/data/test/*.json. Nothing is retyped.
// - The rest of the script (the rules, the order, the follow-ups and the
//   screens) is written unchanged to src/app/[lang]/test/engine/engine.js,
//   with only these joints changed so it can run inside the app:
//     * the data constants read from DATA instead of being inline;
//     * storage goes through ENV (the app's database) instead of window.claude;
//     * the local draft key is per account (ENV.storageKey);
//     * it is exported as startTestEngine(ENV, DATA), hands ENV.ready() a
//       summarize() that uses the test's own result rules, and returns a cleanup.
// Run it again whenever the test page changes; review the diff of the output.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src/data/test");
const ENGINE_FILE = join(ROOT, "src/app/[lang]/test/engine/engine.js");

// Which JSON file each constant goes to; anything not listed goes to tables.json.
const FILES = {
  VERSIONS: "questions",
  VERSIONS_F: "questions",
  COMMON_INTRO: "questions",
  K: "questions",
  FOLLOW: "follow",
  CARDS: "cards",
  COATCARDS: "cards",
  BANK: "bank",
  TAIL: "tail",
};

export function extractScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) throw new Error(`expected one inline <script>, found ${scripts.length}`);
  return scripts[0][1];
}

/** True when a node is a literal value with nothing to run: no calls, names or expressions. */
function isData(node) {
  switch (node.type) {
    case "Literal":
      return !node.regex;
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "UnaryExpression":
      return node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number";
    case "ArrayExpression":
      return node.elements.every((e) => e !== null && isData(e));
    case "ObjectExpression":
      return node.properties.every(
        (p) =>
          p.type === "Property" &&
          p.kind === "init" &&
          !p.computed &&
          !p.method &&
          (p.key.type === "Identifier" || p.key.type === "Literal") &&
          isData(p.value),
      );
    default:
      return false;
  }
}

function toValue(node) {
  switch (node.type) {
    case "Literal":
      return node.value;
    case "TemplateLiteral":
      return node.quasis[0].value.cooked;
    case "UnaryExpression":
      return -node.argument.value;
    case "ArrayExpression":
      return node.elements.map(toValue);
    case "ObjectExpression": {
      const out = {};
      for (const p of node.properties) {
        const key = p.key.type === "Identifier" ? p.key.name : String(p.key.value);
        out[key] = toValue(p.value);
      }
      return out;
    }
    default:
      throw new Error(`not data: ${node.type}`);
  }
}

/** Replaces `find` exactly `count` times, so a changed source fails loudly instead of silently. */
function replaceExactly(source, find, replacement, count) {
  const parts = source.split(find);
  if (parts.length - 1 !== count) {
    throw new Error(`expected ${count} × ${JSON.stringify(find)}, found ${parts.length - 1}`);
  }
  return parts.join(replacement);
}

export function splitTest(html) {
  const script = extractScript(html);
  const ast = acorn.parse(script, { ecmaVersion: "latest", sourceType: "script" });

  // The page's script is one function expression called at once: (function(){ ... })();
  const call = ast.body.length === 1 && ast.body[0].type === "ExpressionStatement" ? ast.body[0].expression : null;
  const fn = call && call.type === "CallExpression" ? call.callee : null;
  if (!fn || fn.type !== "FunctionExpression" || fn.params.length !== 0) {
    throw new Error("expected the script to be a single (function(){ ... })();");
  }

  const data = {};
  const edits = []; // [start, end, text], applied from the end
  for (const statement of fn.body.body) {
    if (statement.type !== "VariableDeclaration" || statement.kind !== "const") continue;
    if (statement.declarations.length !== 1) continue;
    const [decl] = statement.declarations;
    if (decl.id.type !== "Identifier" || !decl.init || !isData(decl.init)) continue;
    data[decl.id.name] = toValue(decl.init);
    edits.push([decl.init.start, decl.init.end, `DATA[${JSON.stringify(decl.id.name)}]`]);
  }

  let body = script.slice(fn.body.start + 1, fn.body.end - 1);
  const offset = fn.body.start + 1;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    body = body.slice(0, start - offset) + text + body.slice(end - offset);
  }

  // The joints with the app (see the header of this file).
  body = replaceExactly(body, "window.claude?.use?.(", "ENV.use(", 2);
  body = replaceExactly(body, '"ikhtibar_attempt"', "ENV.storageKey", 2);

  const engine = `// Generated by scripts/extract-test.mjs from the type test page. Do not edit by hand:
// change the page and run the script again. The rules, questions and order are
// the page's own; only storage and data loading are wired to the app.
/* eslint-disable */
// @ts-nocheck
export function startTestEngine(ENV, DATA) {
${body}
// For the app's lists: the result code of an attempt, computed by the test's own rules.
if (typeof ENV.ready === "function") {
  ENV.ready({
    summarize(st) {
      try {
        const full = Object.assign(blank(), st);
        const r = brResultOf(full);
        return { code: (r && r.code) || null, status: full.status || null, path: full.path || null, name: full.name || "" };
      } catch (e) {
        return null;
      }
    },
  });
}
return () => {
  try { if (timerId) clearInterval(timerId); } catch (e) {}
  try { if (typeof saveWait === "number") clearTimeout(saveWait); } catch (e) {}
  try { if (resultsUnsub) resultsUnsub(); } catch (e) {}
};
}
`;

  const files = {};
  for (const [name, value] of Object.entries(data)) {
    const file = FILES[name] ?? "tables";
    (files[file] ??= {})[name] = value;
  }
  return { engine, files, names: Object.keys(data) };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: node scripts/extract-test.mjs <test.html>");
    process.exit(1);
  }
  const { engine, files, names } = splitTest(readFileSync(input, "utf8"));
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(dirname(ENGINE_FILE), { recursive: true });
  for (const [file, value] of Object.entries(files)) {
    writeFileSync(join(DATA_DIR, `${file}.json`), JSON.stringify(value) + "\n");
  }
  writeFileSync(ENGINE_FILE, engine);
  console.log(`data constants (${names.length}): ${names.join(", ")}`);
  console.log(`files: ${Object.keys(files).map((f) => `src/data/test/${f}.json`).join(", ")}`);
  console.log(`engine: ${engine.length} characters`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
