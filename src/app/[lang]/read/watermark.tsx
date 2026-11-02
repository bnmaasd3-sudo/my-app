const ROWS = 14;
const COLUMNS = 4;

/**
 * The reader's name and email, repeated diagonally across the whole screen at
 * 12% opacity. Rendered on the server as part of every reading page.
 */
export function Watermark({ name, email }: { name: string; email: string }) {
  return (
    <div
      aria-hidden
      data-watermark
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none"
      style={{ opacity: 0.12 }}
    >
      <div className="absolute -inset-1/2 flex -rotate-[30deg] flex-col justify-around">
        {Array.from({ length: ROWS }, (_, row) => (
          <div
            key={row}
            className="flex justify-around gap-16 whitespace-nowrap font-heading text-sm"
            style={{ paddingInlineStart: row % 2 ? "9rem" : 0 }}
          >
            {Array.from({ length: COLUMNS }, (_, column) => (
              <span key={column}>
                <bdi>{name}</bdi> · <bdi dir="ltr">{email}</bdi>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
