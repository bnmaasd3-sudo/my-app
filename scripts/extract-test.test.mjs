import { describe, expect, it } from "vitest";
import { scopeStyles, splitTest } from "./extract-test.mjs";

const STYLES = `<style>:root{color-scheme:light}body{margin:0}</style><style>
:root{--bg:#fff;--accent:#0e6b66}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111}}
html{direction:rtl}
body{background:var(--bg)}
.card{border:1px solid var(--line)}
.btn.primary,.opt.sel{background:var(--accent)}
@media (prefers-reduced-motion:no-preference){.path .nd.cur{animation:pulse 1.4s}@keyframes pulse{50%{stroke-width:4}}}
</style>`;

const page = (body) => `<!doctype html><html><body>${STYLES}<div id="main"></div><script>
(function(){
"use strict";
${body}
})();
</script></body></html>`;

const JOINTS = `
let db=null;
function $(id){return document.getElementById(id);}
async function boot(){ db=await window.claude?.use?.("db"); const u=await window.claude?.use?.("user"); }
function saveLocal(){ localStorage.setItem("ikhtibar_attempt","x"); }
function loadLocal(){ return localStorage.getItem("ikhtibar_attempt"); }
function blank(){ return {}; }
function brResultOf(st){ return {code:"X"}; }
let timerId=null, saveWait=null, resultsUnsub=null;
`;

describe("extract-test", () => {
  it("moves plain data constants to JSON and leaves the logic alone", () => {
    const { engine, files } = splitTest(
      page(`const VERSIONS=[{"id":"13-17","questions":[{"q":"سؤال","o":["أ","ب"]}]}];
const FOLLOW={m:{t1:{dim:"e",q:"سؤال"}}};
const WINDOW_MS=45*60*1000;
const temp=t=>t[1];
${JOINTS}`),
    );
    expect(files.questions.VERSIONS[0].questions[0].o).toEqual(["أ", "ب"]);
    expect(files.follow.FOLLOW).toEqual({ m: { t1: { dim: "e", q: "سؤال" } } });
    expect(engine).toContain('const VERSIONS=DATA["VERSIONS"];');
    // Computed values and functions stay in the logic, untouched.
    expect(engine).toContain("const WINDOW_MS=45*60*1000;");
    expect(engine).toContain("const temp=t=>t[1];");
    expect(engine).toContain("export function startTestEngine(ENV, DATA)");
  });

  it("wires storage to the app and keeps the draft per account", () => {
    const { engine } = splitTest(page(JOINTS));
    expect(engine).not.toContain("window.claude");
    expect(engine).toContain('db=await ENV.use("db")');
    expect(engine).toContain("localStorage.getItem(ENV.storageKey)");
  });

  it("never treats code as data", () => {
    const { files } = splitTest(page(`const A={x:compute()};const B=[1,...rest];const C={[k]:1};const D=\`a\${b}\`;${JOINTS}`));
    expect(Object.values(files).flatMap((f) => Object.keys(f))).toEqual([]);
  });

  it("stops drawing once the app page is gone", () => {
    const { engine } = splitTest(page(JOINTS));
    expect(engine).toContain('function $(id){return STOPPED?document.createElement("div"):document.getElementById(id);}');
    expect(engine).toContain("STOPPED = true;");
  });

  it("scopes the page's own styles to the test and leaves page-wide rules to the app", () => {
    const css = scopeStyles(page(""));
    expect(css).toContain(".test-engine .card{border:1px solid var(--line)}");
    expect(css).toContain(".test-engine .btn.primary,.test-engine .opt.sel{background:var(--accent)}");
    expect(css).toContain("@keyframes pulse");
    expect(css).not.toMatch(/(^|\n)(html|body|:root)\{/);
    expect(css).not.toContain("#0e6b66");
  });

  it("stops when the page changed where the app joins it", () => {
    expect(() => splitTest(page(`const K=["أ"];`))).toThrow(/window\.claude/);
    expect(() => splitTest("<script>var x=1;</script>")).toThrow(/single \(function/);
  });
});
