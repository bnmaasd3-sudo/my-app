import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

/** The test page around the test itself. */
export function TestFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} signedIn />
      <main className="flex flex-1 flex-col gap-6 pt-6 pb-14">
        <TestHeading lang={lang} dict={dict} />
        {children}
      </main>
      <SiteFooter lang={lang} dict={dict} path="/test" />
    </div>
  );
}

function TestHeading({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/${lang}/library`} className="self-start text-sm text-muted hover:text-foreground">
        {dict.type.back}
      </Link>
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-bold">{dict.test.title}</h1>
        <p className="text-muted">{dict.test.lead}</p>
      </div>
    </div>
  );
}
