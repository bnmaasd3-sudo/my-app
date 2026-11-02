import { createHmac, timingSafeEqual } from "node:crypto";

// Salla webhooks (see .claude/skills/salla-sync). Field names follow Salla's
// order payload; confirm them against a real delivery in the owner panel's
// event log before relying on a new event type.

export type SallaAction = "grant" | "revoke" | "ignore";

export type SallaOrderEvent = {
  event: string;
  orderId: string | null;
  status: string | null;
  email: string | null;
  name: string;
  skus: string[];
};

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Accepts either Salla security strategy: an HMAC-SHA256 signature of the raw
 * body in `x-salla-signature`, or the secret as a bearer token.
 */
export function verifySallaRequest(rawBody: string, headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;

  const signature = headers.get("x-salla-signature");
  if (signature) {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    return safeEqual(signature.trim().toLowerCase(), expected);
  }

  const authorization = headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return safeEqual(authorization.slice(7).trim(), secret);
  }
  return false;
}

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : null;

export function parseSallaEvent(payload: unknown): SallaOrderEvent {
  const root = asObject(payload);
  const data = asObject(root.data);
  const customer = asObject(data.customer);
  const status = asObject(data.status);
  const items = Array.isArray(data.items) ? data.items : [];

  const skus = items
    .map((item) => {
      const entry = asObject(item);
      return asText(entry.sku) ?? asText(asObject(entry.product).sku);
    })
    .filter((sku): sku is string => sku !== null);

  return {
    event: asText(root.event) ?? "unknown",
    orderId: asText(data.id) ?? asText(data.reference_id),
    status: (asText(status.slug) ?? asText(data.status))?.toLowerCase() ?? null,
    email: asText(customer.email)?.toLowerCase() ?? null,
    name: [asText(customer.first_name), asText(customer.last_name)].filter(Boolean).join(" "),
    skus: [...new Set(skus)],
  };
}

export const DEFAULT_GRANT_STATUSES = ["in_progress", "completed", "delivering", "delivered", "shipped"];
const REVOKE_EVENTS = ["order.refunded", "order.cancelled", "order.canceled", "order.deleted"];
const REVOKE_STATUSES = ["canceled", "cancelled", "refunded", "restored", "restoring"];

/** What an order event means for the buyer's access. */
export function sallaAction(
  { event, status }: Pick<SallaOrderEvent, "event" | "status">,
  grantStatuses: string[] = DEFAULT_GRANT_STATUSES,
): SallaAction {
  if (!event.startsWith("order.")) return "ignore";
  if (REVOKE_EVENTS.includes(event)) return "revoke";
  if (status && REVOKE_STATUSES.includes(status)) return "revoke";
  if (status && grantStatuses.includes(status)) return "grant";
  return "ignore";
}

/** Grant statuses from SALLA_GRANT_STATUSES ("completed,delivered"), or the defaults. */
export function grantStatusesFromEnv(value: string | undefined): string[] {
  const list = (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_GRANT_STATUSES;
}
