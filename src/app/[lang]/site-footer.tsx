import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** The foot of the public and reader pages: the privacy policy and the terms. */
export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border py-6 text-sm text-muted">
      <span>{dict.footer.rights}</span>
      <Link href={`/${lang}/privacy`} className="hover:text-foreground hover:underline">
        {dict.footer.privacy}
      </Link>
      <Link href={`/${lang}/terms`} className="hover:text-foreground hover:underline">
        {dict.footer.terms}
      </Link>
    </footer>
  );
}
