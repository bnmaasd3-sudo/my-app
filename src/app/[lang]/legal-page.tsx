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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} />
      <main className="flex flex-1 flex-col gap-8 pt-8 pb-14">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold">{kind === "privacy" ? t.privacyTitle : t.termsTitle}</h1>
          <p className="text-sm text-muted">{t.updated}</p>
        </div>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="font-heading font-semibold">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <Suspense fallback={<p className="border-t border-border pt-6">&nbsp;</p>}>
          <Contact dict={dict} />
        </Suspense>
      </main>
      <SiteFooter lang={lang} dict={dict} path={`/${kind}`} />
    </div>
  );
}

/** The owner's address, read on each request so setting OWNER_EMAIL needs no rebuild. */
async function Contact({ dict }: { dict: Dictionary }) {
  await connection();
  const email = process.env.OWNER_EMAIL?.trim();
  return (
    <p className="border-t border-border pt-6">
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
