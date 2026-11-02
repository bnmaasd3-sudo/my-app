import { describe, expect, it } from "vitest";
import { toBlocks } from "./book-text";
import { readerErrorKind } from "./reader-errors";
import { isValidCode, isValidEmail, normalizeCode, normalizeEmail } from "./validation";

describe("toBlocks", () => {
  it("splits paragraphs on blank lines and keeps line breaks inside them", () => {
    expect(toBlocks("أول\nسطر\n\n\nثانٍ")).toEqual([
      { kind: "paragraph", text: "أول\nسطر" },
      { kind: "paragraph", text: "ثانٍ" },
    ]);
  });

  it("turns one-line # blocks into headings", () => {
    expect(toBlocks("## عنوان\n\nنص")).toEqual([
      { kind: "heading", text: "عنوان" },
      { kind: "paragraph", text: "نص" },
    ]);
  });

  it("keeps markup as plain text", () => {
    expect(toBlocks("<script>alert(1)</script>")).toEqual([
      { kind: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });

  it("handles Windows line endings and empty input", () => {
    expect(toBlocks("a\r\n\r\nb")).toHaveLength(2);
    expect(toBlocks("  \n\n ")).toEqual([]);
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
