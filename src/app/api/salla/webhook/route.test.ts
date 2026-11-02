import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type EventRow = { id: number; dedupe_key: string; outcome: string; detail: string | null };

// A stand-in for the service-role Supabase client: just the calls the route makes.
const fake = {
  events: [] as EventRow[],
  rpcs: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: {} as Record<string, unknown>,
};

function serviceClient() {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, key: string) => ({
          maybeSingle: async () => ({ data: fake.events.find((e) => e.dedupe_key === key) ?? null }),
        }),
      }),
      insert: (row: { dedupe_key: string }) => ({
        select: () => ({
          single: async () => {
            const saved = { id: fake.events.length + 1, dedupe_key: row.dedupe_key, outcome: "received", detail: null };
            fake.events.push(saved);
            return { data: { id: saved.id }, error: null };
          },
        }),
      }),
      update: (values: Partial<EventRow>) => {
        const apply = (id: number) => Object.assign(fake.events.find((e) => e.id === id)!, values);
        return {
          eq: (_column: string, id: number) => {
            apply(id);
            return {
              select: () => ({ single: async () => ({ data: { id }, error: null }) }),
              then: (resolve: (v: unknown) => void) => resolve({ error: null }),
            };
          },
        };
      },
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      fake.rpcs.push({ name, args });
      return { data: fake.rpcResult[name], error: null };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => serviceClient() }));

const { POST } = await import("./route");

const SECRET = "salla-test-secret";

function delivery(payload: unknown, secret = SECRET) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("https://qari.test/api/salla/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-salla-signature": signature },
    body,
  });
}

const paidOrder = {
  event: "order.status.updated",
  data: {
    id: 77,
    status: { slug: "completed" },
    customer: { first_name: "Noura", email: "noura@example.com" },
    items: [{ sku: "SKU-INFJ" }],
  },
};

beforeEach(() => {
  process.env.SALLA_WEBHOOK_SECRET = SECRET;
  delete process.env.SALLA_GRANT_STATUSES;
  fake.events = [];
  fake.rpcs = [];
  fake.rpcResult = {
    salla_grant_email: { books: ["infj-t-h-reader"], unknown_skus: [], pending: false },
    salla_revoke_order: 1,
  };
});

describe("POST /api/salla/webhook", () => {
  it("rejects a delivery that is not signed with the shared secret", async () => {
    const response = await POST(delivery(paidOrder, "wrong-secret"));
    expect(response.status).toBe(401);
    expect(fake.events).toHaveLength(0);
    expect(fake.rpcs).toHaveLength(0);
  });

  it("unlocks the book for the buyer on a paid order", async () => {
    const response = await POST(delivery(paidOrder));
    expect(response.status).toBe(200);
    expect(fake.rpcs).toEqual([
      {
        name: "salla_grant_email",
        args: { p_order_id: "77", p_email: "noura@example.com", p_name: "Noura", p_skus: ["SKU-INFJ"] },
      },
    ]);
    expect(fake.events[0].outcome).toBe("granted");
  });

  it("handles a repeated delivery only once", async () => {
    await POST(delivery(paidOrder));
    const again = await POST(delivery(paidOrder));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(fake.rpcs).toHaveLength(1);
  });

  it("locks the book again on a refund", async () => {
    await POST(delivery({ event: "order.refunded", data: { id: 77 } }));
    expect(fake.rpcs).toEqual([{ name: "salla_revoke_order", args: { p_order_id: "77" } }]);
    expect(fake.events[0].outcome).toBe("revoked");
  });

  it("waits while payment is pending", async () => {
    await POST(delivery({ ...paidOrder, data: { ...paidOrder.data, status: { slug: "payment_pending" } } }));
    expect(fake.rpcs).toHaveLength(0);
    expect(fake.events[0].outcome).toBe("ignored");
  });

  it("records an order with no email instead of guessing", async () => {
    await POST(delivery({ ...paidOrder, data: { ...paidOrder.data, customer: {} } }));
    expect(fake.rpcs).toHaveLength(0);
    expect(fake.events[0].outcome).toBe("no_email");
  });

  it("refuses everything when the secret is not configured", async () => {
    delete process.env.SALLA_WEBHOOK_SECRET;
    expect((await POST(delivery(paidOrder))).status).toBe(401);
  });
});
