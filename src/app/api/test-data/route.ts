import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEST_DATA } from "@/lib/test-data";

/** The type test's questions and cards, for signed-in readers only. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  return NextResponse.json(TEST_DATA, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
