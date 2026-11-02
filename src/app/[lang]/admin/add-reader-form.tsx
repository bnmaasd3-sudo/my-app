"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { addReader } from "./actions";

type Props = {
  books: { slug: string; title: string }[];
  dict: Dictionary["admin"];
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-accent";

export function AddReaderForm({ books, dict }: Props) {
  const [state, action, pending] = useActionState(addReader, { status: "idle" });

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
      <h2 className="font-heading text-lg font-semibold sm:col-span-2">{dict.addReader}</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{dict.email}</span>
        <input name="email" type="email" dir="ltr" required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{dict.name}</span>
        <input name="name" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm">{dict.book}</span>
        <select name="book" required className={fieldClass} defaultValue={books[0]?.slug}>
          {books.map((book) => (
            <option key={book.slug} value={book.slug}>
              {book.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          disabled={pending || books.length === 0}
          className="rounded-full bg-accent px-5 py-2.5 font-heading text-accent-foreground disabled:opacity-60"
        >
          {pending ? dict.adding : dict.add}
        </button>
        <p role="status" className="text-sm text-muted">
          {state.status === "linked" && dict.linked}
          {state.status === "invited" && dict.invited}
          {state.status === "error" && state.error && dict.errors[state.error]}
          {books.length === 0 && dict.noBooks}
        </p>
      </div>
    </form>
  );
}
