import { ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "../site-header";

/** The test page around the test itself. */
export function TestFrame({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path="/test" signedIn />
      <main className="flex flex-1 flex-col gap-4 py-6">
        <TestHeading lang={lang} dict={dict} />
        {children}
      </main>
    </div>
  );
}

function TestHeading({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/${lang}/library`}
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden className="rtl:-scale-x-100" />
        {dict.test.back}
      </Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <ClipboardCheck size={22} aria-hidden />
        </span>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{dict.test.title}</h1>
      </div>
      <p className="leading-relaxed text-muted">{dict.test.lead}</p>
    </div>
  );
}
