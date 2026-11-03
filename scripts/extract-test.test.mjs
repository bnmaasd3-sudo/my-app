import { describe, expect, it } from "vitest";
import { splitTest } from "./extract-test.mjs";

const page = (body) => `<!doctype html><html><body><div id="main"></div><script>
(function(){
"use strict";
${body}
})();
</script></body></html>`;

const JOINTS = `
let db=null;
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

  it("stops when the page changed where the app joins it", () => {
    expect(() => splitTest(page(`const K=["أ"];`))).toThrow(/window\.claude/);
    expect(() => splitTest("<script>var x=1;</script>")).toThrow(/single \(function/);
  });
});
