import { grantStatusesFromEnv, parseSallaEvent, sallaAction, verifySallaRequest } from "@/lib/salla";
import { findOrCreateAccount } from "@/lib/supabase/accounts";
import { createServiceClient } from "@/lib/supabase/admin";
import { isValidEmail } from "@/lib/validation";

// Salla order webhook: unlock the book on a paid order, lock it again on a
// cancellation or refund. See .claude/skills/salla-sync/SKILL.md.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySallaRequest(rawBody, request.headers, process.env.SALLA_WEBHOOK_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return Response.json({ error: "not_configured" }, { status: 503 });

  const order = parseSallaEvent(payload);
  const action = sallaAction(order, grantStatusesFromEnv(process.env.SALLA_GRANT_STATUSES));
  const dedupeKey = `${order.event}:${order.orderId ?? "-"}:${order.status ?? "-"}`;

  // Each delivery is handled once; a failed one is retried when Salla resends.
  const { data: seen } = await service
    .from("salla_events")
    .select("id, outcome")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (seen && seen.outcome !== "error") return Response.json({ ok: true, duplicate: true });

  const record = {
    dedupe_key: dedupeKey,
    event: order.event,
    order_id: order.orderId,
    status: order.status,
    email: order.email,
    skus: order.skus,
  };
  const saved = seen
    ? await service.from("salla_events").update({ outcome: "received", detail: null }).eq("id", seen.id).select("id").single()
    : await service.from("salla_events").insert(record).select("id").single();
  if (saved.error) return Response.json({ error: "storage" }, { status: 500 });

  const finish = async (outcome: string, detail?: unknown, status = 200) => {
    await service
      .from("salla_events")
      .update({ outcome, detail: detail === undefined ? null : JSON.stringify(detail) })
      .eq("id", saved.data.id);
    return Response.json({ ok: status < 400, outcome }, { status });
  };

  try {
    if (action === "ignore") return await finish("ignored");
    if (!order.orderId) return await finish("no_order");

    if (action === "revoke") {
      const { data, error } = await service.rpc("salla_revoke_order", { p_order_id: order.orderId });
      if (error) throw error;
      return await finish("revoked", { links: data });
    }

    if (!order.email || !isValidEmail(order.email)) return await finish("no_email");
    if (order.skus.length === 0) return await finish("no_skus");

    const userId = await findOrCreateAccount(service, order.email);
    const { data, error } = await service.rpc("salla_grant_order", {
      p_order_id: order.orderId,
      p_user_id: userId,
      p_email: order.email,
      p_name: order.name,
      p_skus: order.skus,
    });
    if (error) throw error;
    const result = data as { books: string[]; unknown_skus: string[] };
    return await finish(result.books.length > 0 ? "granted" : "unknown_product", result);
  } catch (error) {
    // 500 makes Salla retry; the event stays visible in the owner panel.
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    return await finish("error", message.slice(0, 300), 500);
  }
}
