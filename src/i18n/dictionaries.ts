import type { Locale } from "./config";
import type ar from "./dictionaries/ar.json";

export type Dictionary = typeof ar;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ar: () => import("./dictionaries/ar.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

export const getDictionary = (locale: Locale) => dictionaries[locale]();
