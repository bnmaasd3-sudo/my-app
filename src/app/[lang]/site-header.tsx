import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { signOut } from "./actions";

type Props = {
  lang: Locale;
  dict: Dictionary;
  signedIn?: boolean;
};

/** The wordmark at the start and, once signed in, sign-out at the end. Nothing else. */
export function SiteHeader({ lang, dict, signedIn = false }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <Link
        href={signedIn ? `/${lang}/library` : `/${lang}`}
        className="font-heading text-lg leading-none font-bold text-foreground"
      >
        {dict.app.name}
      </Link>
      {signedIn && (
        <form action={signOut.bind(null, lang)}>
          <button className="text-sm text-muted transition-colors hover:text-foreground">{dict.nav.signOut}</button>
        </form>
      )}
    </header>
  );
}
