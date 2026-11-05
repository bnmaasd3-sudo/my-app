import { describe, expect, it } from "vitest";
import { typeAccent, typeHue } from "./type-accent";

describe("typeAccent", () => {
  it("gives the same type the same colour every time", () => {
    expect(typeAccent("INFJ-T-H")).toBe(typeAccent("INFJ-T-H"));
  });

  it("gives different types different hues", () => {
    expect(typeHue("INFJ-T-H")).not.toBe(typeHue("ESFJ-T-H"));
    for (const code of ["INFJ-T-H", "ESFJ-T-H", "ENTP-A-C", "ISTJ"]) {
      expect(typeHue(code)).toBeGreaterThanOrEqual(0);
      expect(typeHue(code)).toBeLessThan(360);
    }
  });
});
