import { FileText, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * The privacy policy or the terms of use. The contact address is the owner's,
 * from the server-only OWNER_EMAIL variable, read on each request.
 */
export function LegalPage({ lang, dict, kind }: { lang: Locale; dict: Dictionary; kind: "privacy" | "terms" }) {
  const t = dict.legal;
  const sections = kind === "privacy" ? t.privacy : t.terms;
  const Icon = kind === "privacy" ? ShieldCheck : FileText;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} path={`/${kind}`} />
      <main className="flex flex-1 flex-col gap-8 py-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Icon size={22} aria-hidden />
          </span>
          <div className="flex flex-col">
            <h1 className="font-heading text-3xl font-bold">{kind === "privacy" ? t.privacyTitle : t.termsTitle}</h1>
            <p className="text-sm text-muted">{t.updated}</p>
          </div>
        </div>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">{section.title}</h2>
            <p className="leading-loose">{section.body}</p>
          </section>
        ))}
        <Suspense fallback={<p className="rounded-2xl border border-border bg-surface p-5">&nbsp;</p>}>
          <Contact dict={dict} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} />
    </div>
  );
}

/** The owner's address, read on each request so setting OWNER_EMAIL needs no rebuild. */
async function Contact({ dict }: { dict: Dictionary }) {
  await connection();
  const email = process.env.OWNER_EMAIL?.trim();
  return (
    <p className="rounded-2xl border border-border bg-surface p-5 leading-loose">
      {email ? (
        <>
          {dict.legal.contact}{" "}
          <a href={`mailto:${email}`} dir="ltr" className="font-medium text-accent hover:underline">
            {email}
          </a>
        </>
      ) : (
        dict.legal.contactFallback
      )}
    </p>
  );
}
