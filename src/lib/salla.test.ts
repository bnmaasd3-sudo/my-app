import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { grantStatusesFromEnv, parseSallaEvent, sallaAction, verifySallaRequest } from "./salla";

const SECRET = "test-secret";
const body = JSON.stringify({ event: "order.created", data: { id: 42 } });
const sign = (text: string, secret = SECRET) => createHmac("sha256", secret).update(text).digest("hex");

describe("verifySallaRequest", () => {
  it("accepts a correct signature of the raw body", () => {
    const headers = new Headers({ "x-salla-signature": sign(body) });
    expect(verifySallaRequest(body, headers, SECRET)).toBe(true);
  });

  it("rejects a wrong signature, a changed body or another secret", () => {
    expect(verifySallaRequest(body, new Headers({ "x-salla-signature": "00" }), SECRET)).toBe(false);
    expect(verifySallaRequest(`${body} `, new Headers({ "x-salla-signature": sign(body) }), SECRET)).toBe(false);
    expect(verifySallaRequest(body, new Headers({ "x-salla-signature": sign(body, "other") }), SECRET)).toBe(false);
  });

  it("accepts the token strategy only with the exact secret", () => {
    expect(verifySallaRequest(body, new Headers({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
    expect(verifySallaRequest(body, new Headers({ authorization: "Bearer nope" }), SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured or no proof is sent", () => {
    expect(verifySallaRequest(body, new Headers({ "x-salla-signature": sign(body) }), undefined)).toBe(false);
    expect(verifySallaRequest(body, new Headers(), SECRET)).toBe(false);
  });
});

describe("parseSallaEvent", () => {
  it("reads the order, status, buyer and SKUs", () => {
    const event = parseSallaEvent({
      event: "order.status.updated",
      data: {
        id: 9001,
        status: { slug: "Completed" },
        customer: { first_name: "Noura", last_name: "A", email: " Noura@Example.com " },
        items: [{ sku: "SKU-INFJ" }, { product: { sku: "SKU-ESFJ" } }, { sku: "SKU-INFJ" }, { name: "no sku" }],
      },
    });
    expect(event).toEqual({
      event: "order.status.updated",
      orderId: "9001",
      status: "completed",
      email: "noura@example.com",
      name: "Noura A",
      skus: ["SKU-INFJ", "SKU-ESFJ"],
    });
  });

  it("copes with missing fields", () => {
    expect(parseSallaEvent(null)).toEqual({
      event: "unknown",
      orderId: null,
      status: null,
      email: null,
      name: "",
      skus: [],
    });
  });
});

describe("sallaAction", () => {
  it("grants on paid or completed orders", () => {
    expect(sallaAction({ event: "order.created", status: "completed" })).toBe("grant");
    expect(sallaAction({ event: "order.status.updated", status: "in_progress" })).toBe("grant");
  });

  it("waits while payment is pending or under review", () => {
    expect(sallaAction({ event: "order.created", status: "payment_pending" })).toBe("ignore");
    expect(sallaAction({ event: "order.created", status: "under_review" })).toBe("ignore");
  });

  it("revokes on cancellation or refund", () => {
    expect(sallaAction({ event: "order.refunded", status: "completed" })).toBe("revoke");
    expect(sallaAction({ event: "order.status.updated", status: "canceled" })).toBe("revoke");
  });

  it("ignores events that are not about orders", () => {
    expect(sallaAction({ event: "product.updated", status: "completed" })).toBe("ignore");
  });

  it("uses the statuses the owner configures", () => {
    const statuses = grantStatusesFromEnv(" Under_Review , completed ");
    expect(statuses).toEqual(["under_review", "completed"]);
    expect(sallaAction({ event: "order.created", status: "under_review" }, statuses)).toBe("grant");
    expect(grantStatusesFromEnv("")).toContain("completed");
  });
});
