import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const featureKeys = ["login", "resume", "personal"] as const;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const otherLang = locales.find((l) => l !== lang)!;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <span className="font-heading text-2xl font-bold text-accent">
          {dict.app.name}
        </span>
        <Link
          href={`/${otherLang}`}
          hrefLang={otherLang}
          aria-label={dict.nav.switchLanguageLabel}
          className="rounded-full border border-border px-4 py-1.5 text-sm transition-colors hover:bg-surface"
        >
          {dict.nav.switchLanguage}
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-12 py-10">
        <section className="flex flex-col gap-5">
          <h1 className="font-heading text-4xl leading-tight font-bold sm:text-5xl">
            {dict.home.title}
          </h1>
          <p className="max-w-xl text-lg leading-loose text-muted">
            {dict.home.lead}
          </p>
          <div>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3 font-heading text-accent-foreground opacity-60"
            >
              {dict.home.signIn}
              <span className="rounded-full bg-accent-foreground/20 px-2.5 py-0.5 text-xs">
                {dict.home.comingSoon}
              </span>
            </button>
          </div>
        </section>

        <section aria-labelledby="features-title" className="flex flex-col gap-4">
          <h2 id="features-title" className="font-heading text-xl font-semibold">
            {dict.home.featuresTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {featureKeys.map((key) => (
              <li
                key={key}
                className="rounded-2xl border border-border bg-surface p-5"
              >
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

      <footer className="py-6 text-sm text-muted">{dict.footer.rights}</footer>
    </div>
  );
}
