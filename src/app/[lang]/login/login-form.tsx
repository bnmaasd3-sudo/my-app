"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LoginState } from "../actions";

type Props = {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  dict: Dictionary["login"];
  /** Set when the reader came back from a sign-in link that failed. */
  linkError?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-transparent bg-surface px-4 py-3.5 outline-none transition-colors focus:border-accent";
const primaryClass =
  "rounded-xl bg-accent px-6 py-3.5 font-heading text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60";

export function LoginForm({ action, dict, linkError = false }: Props) {
  const [state, formAction, pending] = useActionState(action, {
    step: "email",
    email: "",
    error: linkError ? "link" : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.step === "email" ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-muted">{dict.emailLabel}</span>
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
          <p className="text-muted" role="status">
            {dict.codeSent}
          </p>
          <input type="hidden" name="email" value={state.email} />
          <p dir="ltr" className="text-start font-medium">
            {state.email}
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-muted">{dict.codeLabel}</span>
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
            className="self-start text-sm text-muted underline underline-offset-4"
          >
            {dict.changeEmail}
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-accent">
          {dict.errors[state.error]}
        </p>
      )}
    </form>
  );
}
