export function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Keeps the digits of a typed code, accepting Arabic-Indic digits too. */
export function normalizeCode(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

export function isValidCode(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}
