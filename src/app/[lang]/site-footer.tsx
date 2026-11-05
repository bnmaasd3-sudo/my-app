import Link from "next/link";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * The foot of every page: the other language, the privacy policy and the
 * terms, as plain text. `path` is the page after the locale, kept when
 * switching language (e.g. "/library").
 */
export function SiteFooter({ lang, dict, path = "" }: { lang: Locale; dict: Dictionary; path?: string }) {
  const otherLang = locales.find((l) => l !== lang)!;
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border py-6 text-sm text-muted">
      <Link
        href={`/${otherLang}${path}`}
        hrefLang={otherLang}
        aria-label={dict.nav.switchLanguageLabel}
        className="hover:text-foreground"
      >
        {dict.nav.switchLanguage}
      </Link>
      <Link href={`/${lang}/privacy`} className="hover:text-foreground">
        {dict.footer.privacy}
      </Link>
      <Link href={`/${lang}/terms`} className="hover:text-foreground">
        {dict.footer.terms}
      </Link>
      <span className="ms-auto">{dict.footer.rights}</span>
    </footer>
  );
}
