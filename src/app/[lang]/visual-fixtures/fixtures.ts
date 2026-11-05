import type { LibraryBook } from "../library/library-view";
import type { Contents } from "../read/[book]/contents-view";
import type { OpenedChapter } from "../read/chapter-view";

// Made-up data for the visual check (tests/visual). Not the book's text.

const titles = [
  "المقدمة",
  "من هو هذا النمط",
  "طريقة التفكير",
  "العلاقات والصداقة",
  "العمل والدراسة",
  "الضغط وكيف يتعامل معه",
  "النمو الشخصي",
  "الخاتمة",
];

export const chapters = titles.map((title, index) => ({ position: index + 1, title }));

const paragraph =
  "يميل صاحب هذا النمط إلى التأمل العميق في دوافع الناس ومشاعرهم، ويبحث عن المعنى خلف كل موقف يمر به. وهو يحتاج إلى وقت هادئ يعيد فيه ترتيب أفكاره قبل أن يعود إلى من حوله بطاقة جديدة، ويقدّر الصدق في العلاقات أكثر من كثرتها.";

// A wide figure, to check that images never push the page sideways.
const figure =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="1600" height="600" fill="#e7e0d5"/></svg>',
  );

export const figures = { "wide.png": figure };

export const opened: OpenedChapter = {
  book: { slug: "fixture-book", title: "نسخة القارئ التجريبية", lang: "ar" },
  chapter: {
    position: 3,
    title: "طريقة التفكير عند هذا النمط وما يميزه عن غيره",
    body: [
      paragraph,
      paragraph,
      "## عنوان فرعي في الفصل",
      "> اقتباس قصير يظهر بإطار هادئ على جانب البداية.",
      paragraph,
      "![شكل عريض للتجربة](الأشكال/wide.png)",
      "| الجانب | الوصف |\n|---|---|\n| التفكير | هادئ وعميق ويبحث عن المعنى خلف المواقف |\n| العلاقات | قليلة وصادقة |",
      paragraph,
      paragraph,
    ].join("\n\n"),
  },
  total: chapters.length,
  scroll_ratio: 0,
  reader: { name: "قارئة التجربة", email: "visual-check@example.com" },
};

export const contents: Contents = {
  book: opened.book,
  chapters,
  position: 3,
};

export const books: LibraryBook[] = [
  { slug: "fixture-book", title: "نسخة القارئ التجريبية", lang: "ar", position: 3, chapters: 33, type_code: "INFJ-T-H", kind: "encyclopedia" },
  { slug: "fixture-novel", title: "رواية تجريبية بعنوان أطول قليلًا من غيرها", lang: "ar", position: null, chapters: 16, type_code: "INFJ-T-H", kind: "novel" },
  { slug: "fixture-appendix", title: "ملحقات تجريبية", lang: "ar", position: 2, chapters: 8, type_code: "INFJ-T-H", kind: "appendix" },
  { slug: "fixture-esfj", title: "موسوعة تجريبية ثانية", lang: "ar", position: null, chapters: 30, type_code: "ESFJ-T-H", kind: "encyclopedia" },
];
