import { describe, expect, it } from "vitest";
import { dir, hasLocale } from "./config";
import ar from "./dictionaries/ar.json";
import en from "./dictionaries/en.json";
import { negotiateLocale } from "./negotiate";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leaves(value: unknown): unknown[] {
  if (value === null || typeof value !== "object") return [value];
  return Object.values(value).flatMap(leaves);
}

describe("dictionaries", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ar).sort());
  });

  it("every string is filled in", () => {
    for (const leaf of [...leaves(ar), ...leaves(en)]) {
      expect(typeof leaf).toBe("string");
      expect((leaf as string).trim()).not.toBe("");
    }
  });
});

describe("locale config", () => {
  it("recognises only supported locales", () => {
    expect(hasLocale("ar")).toBe(true);
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("fr")).toBe(false);
  });

  it("Arabic is right-to-left and English left-to-right", () => {
    expect(dir("ar")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });
});

describe("negotiateLocale", () => {
  it("defaults to Arabic without a header", () => {
    expect(negotiateLocale(null)).toBe("ar");
    expect(negotiateLocale("")).toBe("ar");
  });

  it("matches regional tags to their base language", () => {
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("ar-SA")).toBe("ar");
  });

  it("respects quality values", () => {
    expect(negotiateLocale("ar;q=0.4,en;q=0.8")).toBe("en");
    expect(negotiateLocale("en;q=0,ar;q=0.1")).toBe("ar");
  });

  it("skips unsupported languages and falls back to Arabic", () => {
    expect(negotiateLocale("fr-FR,de;q=0.9,en;q=0.5")).toBe("en");
    expect(negotiateLocale("fr-FR,de;q=0.9")).toBe("ar");
  });
});
