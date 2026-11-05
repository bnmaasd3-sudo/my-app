/** The reader's display choices, shared by the reading screen and the server action that saves them. */
export const FONT_SIZES = ["sm", "md", "lg"] as const;
export const THEMES = ["system", "light", "dark", "sepia"] as const;
export const LAYOUTS = ["auto", "mobile", "laptop"] as const;
/** Width of the text column, on top of the layout. */
export const WIDTHS = ["narrow", "md", "wide"] as const;

export type FontSize = (typeof FONT_SIZES)[number];
export type Theme = (typeof THEMES)[number];
export type Layout = (typeof LAYOUTS)[number];
export type Width = (typeof WIDTHS)[number];

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const isFontSize = (value: unknown): value is FontSize => isOneOf(FONT_SIZES, value);
export const isTheme = (value: unknown): value is Theme => isOneOf(THEMES, value);
export const isLayout = (value: unknown): value is Layout => isOneOf(LAYOUTS, value);
export const isWidth = (value: unknown): value is Width => isOneOf(WIDTHS, value);
