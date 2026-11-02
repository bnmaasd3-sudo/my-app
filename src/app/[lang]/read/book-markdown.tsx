import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { figureName } from "@/lib/book-text";

type Props = {
  body: string;
  /** Signed URLs by figure file name; figures without one show their caption. */
  figures: Record<string, string>;
};

const components: Components = {
  h1: ({ children }) => <h2 className="mt-10 mb-4 font-heading text-[1.3em] font-bold">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-10 mb-4 font-heading text-[1.25em] font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-8 mb-3 font-heading text-[1.12em] font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-6 mb-3 font-heading text-[1.02em] font-semibold">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-6 mb-2 font-heading font-semibold">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-6 mb-2 font-heading font-semibold">{children}</h6>,
  p: ({ children }) => <p className="mb-5">{children}</p>,
  ul: ({ children }) => <ul className="mb-5 list-disc space-y-2 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2 ps-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mb-5 border-s-4 border-border ps-4 text-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse text-[0.85em]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface px-3 py-2 text-start font-heading">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
  // Links stay as text: the reader never leaves the book from inside it.
  a: ({ children }) => <span>{children}</span>,
};

/** Renders a chapter's Markdown as plain React elements; raw HTML is dropped. */
export function BookMarkdown({ body, figures }: Props) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        ...components,
        img: ({ src, alt }) => {
          const name = figureName(typeof src === "string" ? src : null);
          const url = name ? figures[name] : undefined;
          return (
            <span className="my-6 block">
              {url && (
                // Signed, short-lived URLs from private storage; next/image would cache them.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={alt ?? ""}
                  loading="lazy"
                  draggable={false}
                  className="mx-auto max-h-[80vh] w-auto max-w-full rounded-xl"
                />
              )}
              {alt && <span className="mt-2 block text-center text-[0.85em] text-muted">{alt}</span>}
            </span>
          );
        },
      }}
    >
      {body}
    </Markdown>
  );
}
