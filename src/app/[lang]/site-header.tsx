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
        className="font-heading text-2xl font-bold text-accent"
      >
        {dict.app.name}
      </Link>
      <div className="flex items-center gap-2">
        {signedIn && (
          <form action={signOut.bind(null, lang)}>
            <button className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface">
              {dict.nav.signOut}
            </button>
          </form>
        )}
        <Link
          href={`/${otherLang}${path}`}
          hrefLang={otherLang}
          aria-label={dict.nav.switchLanguageLabel}
          className="rounded-full border border-border px-4 py-1.5 text-sm transition-colors hover:bg-surface"
        >
          {dict.nav.switchLanguage}
        </Link>
      </div>
    </header>
  );
}
