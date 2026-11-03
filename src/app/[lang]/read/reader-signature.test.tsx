import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderSignature } from "./reader-signature";

describe("ReaderSignature", () => {
  const html = renderToStaticMarkup(
    <ReaderSignature label="نسخة خاصة بـ" name="نورة" email="noura@example.com" />,
  );

  it("shows the reader's name and email", () => {
    expect(html).toContain("نورة");
    expect(html).toContain("noura@example.com");
  });

  it("appears once, as a footer line, not tiled over the text", () => {
    expect(html.match(/noura@example\.com/g)).toHaveLength(1);
    expect(html.startsWith("<footer")).toBe(true);
    expect(html).not.toContain("fixed");
  });
});
