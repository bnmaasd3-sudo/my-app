/**
 * One faint line at the foot of every reading page with the reader's name and
 * email. It sits below the chapter, outside the text, and is not repeated
 * (the owner dropped the tiled watermark because it distracted readers).
 * Rendered on the server as part of the page.
 */
export function ReaderSignature({
  label,
  name,
  email,
}: {
  label: string;
  name: string;
  email: string;
}) {
  return (
    <footer
      data-reader-signature
      className="reader-signature border-t border-border py-6 text-center text-xs text-muted opacity-70 select-none"
    >
      {label} <bdi>{name}</bdi> · <bdi dir="ltr">{email}</bdi>
    </footer>
  );
}
