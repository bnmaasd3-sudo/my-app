export type TextBlock = { kind: "heading" | "paragraph"; text: string };

/**
 * Splits a stored chapter body into headings and paragraphs. Paragraphs are
 * separated by blank lines; a one-line block starting with "#" is a heading.
 * Rendered as plain text, never as HTML.
 */
export function toBlocks(body: string): TextBlock[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const heading = /^#{1,6}\s+([^\n]+)$/.exec(chunk);
      return heading
        ? { kind: "heading", text: heading[1].trim() }
        : { kind: "paragraph", text: chunk };
    });
}
