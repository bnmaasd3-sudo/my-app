import { describe, expect, it } from "vitest";
import { figureName, figurePaths } from "./book-text";
import { readerErrorKind } from "./reader-errors";
import { isValidCode, isValidEmail, normalizeCode, normalizeEmail } from "./validation";

describe("figures", () => {
  it("finds every figure a chapter refers to, once, under the book's folder", () => {
    const body = "![](الأشكال/opening_00.jpg)\n\nنص ![الوظائف](الأشكال/fig01.png) و![](الأشكال/fig01.png)";
    expect(figurePaths(body, "infj-t-h-reader")).toEqual([
      "infj-t-h-reader/figures/opening_00.jpg",
      "infj-t-h-reader/figures/fig01.png",
    ]);
  });

  it("accepts encoded references and refuses anything that is not a plain image name", () => {
    expect(figureName(encodeURI("الأشكال/fig02_x.png"))).toBe("fig02_x.png");
    expect(figureName("../../secret.sql")).toBeNull();
    expect(figureName("javascript:alert(1)")).toBeNull();
    expect(figureName(undefined)).toBeNull();
  });
});

describe("readerErrorKind", () => {
  it("maps database errors to reader messages", () => {
    expect(readerErrorKind({ message: "not_entitled" })).toBe("notEntitled");
    expect(readerErrorKind({ message: "device_limit" })).toBe("deviceLimit");
    expect(readerErrorKind({ message: "device_revoked" })).toBe("deviceRevoked");
    expect(readerErrorKind({ message: "reader_inactive" })).toBe("inactive");
    expect(readerErrorKind({ message: "not_authenticated" })).toBe("signedOut");
    expect(readerErrorKind({ message: "chapter_not_found" })).toBe("notFound");
  });

  it("falls back to a generic message", () => {
    expect(readerErrorKind({ message: "fetch failed" })).toBe("generic");
    expect(readerErrorKind(null)).toBe("generic");
  });
});

describe("email and code validation", () => {
  it("normalises and checks emails", () => {
    expect(normalizeEmail("  Noura@Example.COM ")).toBe("noura@example.com");
    expect(isValidEmail("noura@example.com")).toBe(true);
    expect(isValidEmail("noura@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("accepts codes typed with Arabic digits or spaces", () => {
    expect(normalizeCode("١٢٣ ٤٥٦")).toBe("123456");
    expect(normalizeCode("۱۲۳۴۵۶")).toBe("123456");
    expect(isValidCode("123456")).toBe(true);
    expect(isValidCode("12345")).toBe(false);
    expect(normalizeCode(null)).toBe("");
  });
});
