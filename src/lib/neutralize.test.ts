import { describe, expect, it } from "vitest";
import { neutralizeMarkup } from "./neutralize";

describe("neutralizeMarkup", () => {
  it("leaves no markup in strings, nested values or keys", () => {
    const attack = {
      age: '<img src=x onerror="alert(1)">',
      cardSets: [{ type: "INFJ'><script>", at: "A" }],
      ["<b>"]: { conf: "&lt;" },
    };
    const safe = JSON.stringify(neutralizeMarkup(attack));
    expect(safe).not.toMatch(/[<>&']/);
    expect(safe).not.toContain('\\"');
  });

  it("keeps ordinary values as they are", () => {
    const attempt = { status: "done", path: "branch", age: 24, name: "نورة", answers: [0, 2, null], ok: true };
    expect(neutralizeMarkup(attempt)).toEqual(attempt);
  });
});
