import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/locale";
import { isLayout } from "@/lib/reader-prefs";
import { TEST_DATA } from "@/lib/test-data";
import { LibraryFrame, LibraryShelves } from "../../library/library-view";
import { ContentsFrame, ContentsView } from "../../read/[book]/contents-view";
import { ChapterView } from "../../read/chapter-view";
import { TestEngineHost } from "../../test/test-engine-host";
import { TestFrame } from "../../test/test-view";
import { TypeView } from "../../type/type-view";
import { books, chapters, contents, figures, opened } from "../fixtures";

/**
 * The library, contents and reading screens filled with made-up data, for the
 * visual check in tests/visual. Off unless the server runs with
 * VISUAL_FIXTURES=1 (CI sets it; production never does): src/proxy.ts answers
 * a plain 404 for it on the real site. It reads no account or book data.
 */
export default function VisualFixturePage({
  params,
  searchParams,
}: PageProps<"/[lang]/visual-fixtures/[screen]">) {
  return (
    <Suspense>
      <Screen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Screen({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // src/proxy.ts already answers 404 when the switch is off; this is a second lock.
  await connection();
  if (process.env.VISUAL_FIXTURES !== "1") notFound();

  const lang: Locale = await currentLocale();
  const dict = await getDictionary(lang);
  const { screen } = await params;
  const { layout } = await searchParams;

  switch (screen) {
    case "library":
      return (
        <LibraryFrame lang={lang} dict={dict}>
          <LibraryShelves lang={lang} dict={dict} books={books} isAdmin />
        </LibraryFrame>
      );
    case "contents":
      return (
        <ContentsFrame lang={lang} dict={dict}>
          <ContentsView lang={lang} dict={dict} contents={contents} />
        </ContentsFrame>
      );
    case "chapter":
      return (
        <ChapterView
          lang={lang}
          dict={dict}
          data={opened}
          chapters={chapters}
          figures={figures}
          prefs={{ layout: isLayout(layout) ? layout : "auto" }}
        />
      );
    case "type":
      return (
        <TypeView
          code="INFJ-T-H"
          books={books.filter((book) => book.type_code === "INFJ-T-H")}
          lang={lang}
          dict={dict}
        />
      );
    case "test":
      // The real test with its real data, saving nothing.
      return (
        <TestFrame lang={lang} dict={dict}>
          <TestEngineHost userId="visual-check" isOwner={false} labels={dict.test} fixture={{ data: TEST_DATA }} />
        </TestFrame>
      );
    case "test-owner":
      // The owner's side of the test (results list, trials, path choice), with no results.
      return (
        <TestFrame lang={lang} dict={dict}>
          <TestEngineHost userId="visual-check" isOwner labels={dict.test} fixture={{ data: TEST_DATA }} />
        </TestFrame>
      );
    default:
      notFound();
  }
}
