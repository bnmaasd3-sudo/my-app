"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LoginState } from "../actions";

type Props = {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  dict: Dictionary["login"];
};

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-accent";
const primaryClass =
  "rounded-full bg-accent px-6 py-3 font-heading text-accent-foreground disabled:opacity-60";

export function LoginForm({ action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, { step: "email", email: "" });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.step === "email" ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-heading">{dict.emailLabel}</span>
            <input
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state.email}
              className={inputClass}
            />
          </label>
          <button name="intent" value="send" disabled={pending} className={primaryClass}>
            {pending ? dict.pending : dict.sendCode}
          </button>
        </>
      ) : (
        <>
          <p className="leading-relaxed text-muted" role="status">
            {dict.codeSent}
          </p>
          <input type="hidden" name="email" value={state.email} />
          <p dir="ltr" className="text-start font-medium">
            {state.email}
          </p>
          <label className="flex flex-col gap-2">
            <span className="font-heading">{dict.codeLabel}</span>
            <input
              name="code"
              dir="ltr"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              className={`${inputClass} tracking-[0.4em]`}
            />
          </label>
          <button name="intent" value="verify" disabled={pending} className={primaryClass}>
            {pending ? dict.pending : dict.verify}
          </button>
          <button
            name="intent"
            value="reset"
            formNoValidate
            disabled={pending}
            className="text-sm text-muted underline"
          >
            {dict.changeEmail}
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl border border-border bg-surface p-3 text-sm">
          {dict.errors[state.error]}
        </p>
      )}
    </form>
  );
}
