import { existsSync, mkdirSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PORT } from "./server";

/**
 * Visual check of the reading screen, the contents page and the library at a
 * phone width and a laptop width, in light and dark, in Arabic and English.
 * Fails on a horizontal scroll, or when the text is squeezed below 60% of the
 * screen. Text in a column that already reached its designed maximum width
 * passes when it fills that column (on a wide screen 60% would make lines too
 * long to read).
 * Screenshots go to test-results/visual for a look by eye.
 */

const BASE = process.env.VISUAL_BASE_URL ?? `http://localhost:${PORT}`;
const OUT = "test-results/visual";
// The browser that comes with this project's cloud sessions; elsewhere
// Playwright uses the one from `npx playwright install chromium`.
const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium";

const WIDTHS = [390, 1280];
const SCHEMES = ["light", "dark"] as const;
const LANGS = ["ar", "en"];
const SCREENS = [
  // `column` is the element whose max-width bounds the text.
  { name: "chapter", path: "chapter", text: "article.reader-text", column: ".reader-column" },
  // The bug the owner hit: "laptop" chosen on a phone left one word per line.
  { name: "chapter-laptop", path: "chapter?layout=laptop", text: "article.reader-text", column: ".reader-column" },
  { name: "contents", path: "contents", text: "main", column: ":has(> main)" },
  { name: "library", path: "library", text: "main", column: ":has(> main)" },
];

let browser: Browser;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({
    executablePath: existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined,
  });
});

afterAll(async () => {
  await browser?.close();
});

async function measure(page: Page, textSelector: string, columnSelector: string) {
  return page.evaluate(
    ({ textSelector, columnSelector }) => {
      const text = document.querySelector(textSelector);
      const column = document.querySelector(columnSelector);
      const sidebar = document.querySelector(".reader-sidebar");
      if (!text || !column) return null;
      const columnWidth = column.getBoundingClientRect().width;
      const maxWidth = parseFloat(getComputedStyle(column).maxWidth);
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        textWidth: text.getBoundingClientRect().width,
        columnWidth,
        columnAtMax: Number.isFinite(maxWidth) && columnWidth >= maxWidth - 1,
        sidebarShown: sidebar !== null && getComputedStyle(sidebar).display !== "none",
      };
    },
    { textSelector, columnSelector },
  );
}

for (const lang of LANGS) {
  for (const screen of SCREENS) {
    for (const width of WIDTHS) {
      for (const scheme of SCHEMES) {
        const label = `${lang} ${screen.name} ${width}px ${scheme}`;
        describe(label, () => {
          it("has no horizontal scroll and a text column of at least 60% of the width", async () => {
            const page = await browser.newPage({
              viewport: { width, height: 900 },
              colorScheme: scheme,
            });
            try {
              const response = await page.goto(`${BASE}/${lang}/visual-fixtures/${screen.path}`, {
                waitUntil: "networkidle",
              });
              expect(response?.status(), "fixture page answered").toBe(200);
              // Load every image now (they are lazy), so wide figures count in the layout.
              await page.evaluate(async () => {
                const images = Array.from(document.images);
                for (const image of images) image.loading = "eager";
                await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
              });
              expect(
                await page.evaluate(() => Array.from(document.images).every((image) => image.complete)),
                "images loaded",
              ).toBe(true);
              await page.screenshot({
                path: `${OUT}/${lang}-${screen.name}-${width}-${scheme}.png`,
                fullPage: true,
              });

              const m = await measure(page, screen.text, screen.column);
              expect(m, "text and column found").not.toBeNull();
              expect(m!.scrollWidth, "no horizontal scroll").toBeLessThanOrEqual(m!.viewport);
              const ratio = m!.textWidth / m!.viewport;
              const fillsFullColumn = m!.columnAtMax && m!.textWidth >= 0.85 * m!.columnWidth;
              expect(
                ratio >= 0.6 || fillsFullColumn,
                `text is ${Math.round(ratio * 100)}% of the width, and does not fill a column at its maximum`,
              ).toBe(true);

              if (screen.name.startsWith("chapter")) {
                // The chapter list sits beside the text only on wide screens.
                expect(m!.sidebarShown, "side contents column").toBe(width >= 1024);
              }
            } finally {
              await page.close();
            }
          });
        });
      }
    }
  }
}
