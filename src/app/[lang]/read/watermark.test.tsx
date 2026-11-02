import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Watermark } from "./watermark";

describe("Watermark", () => {
  const html = renderToStaticMarkup(<Watermark name="نورة" email="noura@example.com" />);

  it("shows the reader's name and email", () => {
    expect(html).toContain("نورة");
    expect(html).toContain("noura@example.com");
  });

  it("repeats across the screen so it cannot be cropped out of one corner", () => {
    expect(html.match(/noura@example\.com/g)?.length).toBeGreaterThanOrEqual(20);
  });

  it("is drawn at 12% opacity over the page and never blocks touches", () => {
    expect(html).toContain("opacity:0.12");
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("fixed inset-0");
    expect(html).toContain('aria-hidden="true"');
  });
});
