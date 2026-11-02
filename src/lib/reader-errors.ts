export type ReaderErrorKind =
  | "signedOut"
  | "notEntitled"
  | "notFound"
  | "deviceLimit"
  | "deviceRevoked"
  | "inactive"
  | "generic";

const KINDS: [string, ReaderErrorKind][] = [
  ["not_authenticated", "signedOut"],
  ["not_entitled", "notEntitled"],
  ["chapter_not_found", "notFound"],
  ["device_limit", "deviceLimit"],
  ["device_revoked", "deviceRevoked"],
  ["reader_inactive", "inactive"],
];

/** Maps an error raised by the database functions to what the reader is told. */
export function readerErrorKind(error: { message?: string } | null | undefined): ReaderErrorKind {
  const message = error?.message ?? "";
  return KINDS.find(([code]) => message.includes(code))?.[1] ?? "generic";
}
