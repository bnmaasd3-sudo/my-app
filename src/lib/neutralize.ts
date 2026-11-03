/**
 * Makes every string in a value unable to act as HTML: the five markup
 * characters become look-alike full-width forms, in values and in keys.
 *
 * The type test draws its owner screens with innerHTML and does not escape
 * every field. A reader controls their own attempt, so an attempt shown to
 * anyone else (the owner's list and details, a pasted result code) goes
 * through this first. The reader's own attempt is left exactly as saved.
 */
const LOOK_ALIKES: Record<string, string> = {
  "<": "＜",
  ">": "＞",
  "&": "＆",
  '"': "＂",
  "'": "＇",
};

const clean = (text: string) => text.replace(/[<>&"']/g, (c) => LOOK_ALIKES[c]);

export function neutralizeMarkup<T>(value: T): T {
  if (typeof value === "string") return clean(value) as T;
  if (Array.isArray(value)) return value.map(neutralizeMarkup) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [clean(key), neutralizeMarkup(inner)]),
    ) as T;
  }
  return value;
}
