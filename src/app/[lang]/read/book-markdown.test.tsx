import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookMarkdown } from "./book-markdown";

const render = (body: string, figures: Record<string, string> = {}) =>
  renderToStaticMarkup(<BookMarkdown body={body} figures={figures} />);

describe("BookMarkdown", () => {
  it("renders bold text, lists, headings and tables instead of showing the marks", () => {
    const html = render(
      "### عنوان\n\n**عريض** ونص\n\n- أول\n- ثانٍ\n\n1. واحد\n\n| أ | ب |\n|---|---|\n| ج | د |",
    );
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>عريض</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<table");
    expect(html).not.toContain("**");
  });

  it("drops raw HTML and turns links into plain text", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[رابط](https://evil.example)');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("href");
    expect(html).toContain("رابط");
  });

  it("shows a figure from its signed URL, with its caption", () => {
    const html = render("![الوظائف الثماني](الأشكال/fig01.png)", { "fig01.png": "https://signed.example/fig01" });
    expect(html).toContain('src="https://signed.example/fig01"');
    expect(html).toContain("الوظائف الثماني");
  });

  it("never points an image at the raw path when it has no signed URL", () => {
    const html = render("![شكل](الأشكال/missing.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain("شكل");
  });
});
