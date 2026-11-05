import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const features = ["login", "resume", "personal"] as const;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
      <SiteHeader lang={lang} dict={dict} />

      <main className="flex flex-1 flex-col justify-center gap-14 py-12">
        <section className="flex flex-col items-start gap-6">
          <h1 className="font-heading text-4xl leading-tight font-bold">{dict.home.title}</h1>
          <span aria-hidden className="block h-px w-12 bg-accent" />
          <p className="text-muted">{dict.home.lead}</p>
          <Link
            href={`/${lang}/login`}
            className="rounded-xl bg-accent px-6 py-3 font-heading text-accent-foreground transition-opacity hover:opacity-90"
          >
            {dict.home.signIn}
          </Link>
        </section>

        <section aria-labelledby="features-title" className="flex flex-col gap-4">
          <h2 id="features-title" className="text-sm text-muted">
            {dict.home.featuresTitle}
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {features.map((key) => (
              <li key={key} className="flex flex-col gap-1 py-5">
                <h3 className="font-heading font-semibold">{dict.home.features[key].title}</h3>
                <p className="text-muted">{dict.home.features[key].body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter lang={lang} dict={dict} />
    </div>
  );
}
