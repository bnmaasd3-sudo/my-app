import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ReaderErrorKind } from "@/lib/reader-errors";

type Props = { kind: ReaderErrorKind; lang: Locale; dict: Dictionary };

/** Explains why a reading page could not open, in the reader's language. */
export function ReaderError({ kind, lang, dict }: Props) {
  if (kind === "signedOut") redirect(`/${lang}/login`);
  if (kind === "notFound") notFound();

  return (
    <div role="alert" className="flex flex-col items-start gap-4 border-y border-border py-6">
      <p>{dict.errors[kind]}</p>
      <Link href={`/${lang}/library`} className="text-accent underline underline-offset-4">
        {dict.errors.backToLibrary}
      </Link>
    </div>
  );
}
