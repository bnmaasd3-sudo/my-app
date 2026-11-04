import { BookMarked, History, KeyRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const features: { key: "login" | "resume" | "personal"; icon: LucideIcon }[] = [
  { key: "login", icon: KeyRound },
  { key: "resume", icon: History },
  { key: "personal", icon: BookMarked },
];

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} />

      <main className="flex flex-1 flex-col justify-center gap-12 py-10">
        <section className="flex flex-col gap-5">
          <h1 className="font-heading text-4xl leading-tight font-bold sm:text-5xl">
            {dict.home.title}
          </h1>
          <p className="max-w-xl text-lg leading-loose text-muted">
            {dict.home.lead}
          </p>
          <div>
            <Link
              href={`/${lang}/login`}
              className="inline-flex items-center rounded-full bg-accent px-6 py-3 font-heading text-accent-foreground"
            >
              {dict.home.signIn}
            </Link>
          </div>
        </section>

        <section aria-labelledby="features-title" className="flex flex-col gap-4">
          <h2 id="features-title" className="font-heading text-xl font-semibold">
            {dict.home.featuresTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {features.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="font-heading font-semibold">
                  {dict.home.features[key].title}
                </h3>
                <p className="mt-2 leading-relaxed text-muted">
                  {dict.home.features[key].body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter lang={lang} dict={dict} />
    </div>
  );
}
