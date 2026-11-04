"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { resendWelcome, type ResendState } from "./actions";

/** "Resend welcome" for one reader or invited email, with what happened next to it. */
export function ResendWelcome({
  email,
  name,
  lang,
  dict,
}: {
  email: string;
  name: string | null;
  lang: Locale;
  dict: Dictionary["admin"];
}) {
  const [state, action, pending] = useActionState(resendWelcome, { status: "idle" } as ResendState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name ?? ""} />
      <input type="hidden" name="lang" value={lang} />
      <button
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-background disabled:opacity-60"
      >
        <Mail size={14} aria-hidden />
        {pending ? dict.resending : dict.resendWelcome}
      </button>
      <span role="status" className="text-xs text-muted">
        {state.status === "sent" && dict.resent}
        {state.status === "skipped" && dict.mail.skipped}
        {(state.status === "failed" || state.status === "error") && dict.mail.failed}
      </span>
    </form>
  );
}
