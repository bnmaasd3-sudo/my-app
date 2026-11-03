import { BookOpen, Languages, LogOut } from "lucide-react";
import Link from "next/link";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { signOut } from "./actions";

type Props = {
  lang: Locale;
  dict: Dictionary;
  /** Path after the locale to keep when switching language, e.g. "/library". */
  path?: string;
  signedIn?: boolean;
};

export function SiteHeader({ lang, dict, path = "", signedIn = false }: Props) {
  const otherLang = locales.find((l) => l !== lang)!;

  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <Link
        href={signedIn ? `/${lang}/library` : `/${lang}`}
        className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-accent"
      >
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <BookOpen size={20} aria-hidden />
        </span>
        {dict.app.name}
      </Link>
      <div className="flex items-center gap-2">
        {signedIn && (
          <form action={signOut.bind(null, lang)}>
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface">
              <LogOut size={16} aria-hidden className="rtl:-scale-x-100" />
              <span className="max-sm:sr-only">{dict.nav.signOut}</span>
            </button>
          </form>
        )}
        <Link
          href={`/${otherLang}${path}`}
          hrefLang={otherLang}
          aria-label={dict.nav.switchLanguageLabel}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors hover:bg-surface"
        >
          <Languages size={16} aria-hidden />
          {dict.nav.switchLanguage}
        </Link>
      </div>
    </header>
  );
}
