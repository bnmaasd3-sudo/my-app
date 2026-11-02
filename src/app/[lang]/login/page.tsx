import type { Metadata } from "next";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { login } from "../actions";
import { SiteHeader } from "../site-header";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await currentLocale());
  return { title: dict.login.title };
}

export default async function LoginPage() {
  const lang = await currentLocale();
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <SiteHeader lang={lang} dict={dict} />
      <main className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-bold">{dict.login.title}</h1>
          <p className="leading-relaxed text-muted">{dict.login.lead}</p>
        </div>
        <LoginForm action={login.bind(null, lang)} dict={dict.login} />
      </main>
    </div>
  );
}
