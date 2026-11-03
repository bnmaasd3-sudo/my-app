"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { getTestDoc, listTestResults, setTestDoc } from "./actions";
import "./test-engine.css";

type Doc = Record<string, unknown>;
type Summarize = (attempt: Doc) => unknown;

type Props = {
  /** The signed-in account; the reader's attempt is kept under this id. */
  userId: string;
  /** True in the owner panel: the test opens on its results list. */
  isOwner: boolean;
  labels: Dictionary["test"];
  /** Made-up runs for the visual check: data given here and nothing saved. */
  fixture?: { data: Doc };
};

/** Errors the test treats as final: it stops saving and shows the result code to copy. */
class StoreError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/**
 * The storage the test expects (the one its own page had), on top of the app's
 * database: doc(path).get()/set() and collection("results").onSnapshot().
 */
function databaseFor(summarize: () => Summarize | null) {
  // The test expects a live results list; it is fetched again after every save and every half minute.
  const listeners = new Set<() => void>();
  const refreshAll = () => listeners.forEach((refresh) => refresh());
  return {
    doc(path: string) {
      return {
        async get() {
          const result = await getTestDoc(path);
          if (!result.ok) throw new StoreError(result.code);
          return { exists: result.exists, data: () => result.data };
        },
        async set(value: Doc) {
          const result = await setTestDoc(path, value, summarize()?.(value) ?? null);
          if (!result.ok) throw new StoreError(result.code);
          if (path.startsWith("results/")) refreshAll();
        },
      };
    },
    collection() {
      return {
        onSnapshot(onData: (snap: unknown) => void, onError?: (error: unknown) => void) {
          let live = true;
          const refresh = () =>
            listTestResults().then((result) => {
              if (!live) return;
              if (!result.ok) return onError?.(new StoreError(result.code));
              onData({
                docs: result.rows.map((row) => ({ id: row.key, exists: true, data: () => row.answers })),
              });
            }, onError);
          listeners.add(refresh);
          const timer = setInterval(refresh, 30_000);
          refresh();
          return () => {
            live = false;
            listeners.delete(refresh);
            clearInterval(timer);
          };
        },
      };
    },
  };
}

/** A database that keeps nothing, for the visual check. */
const emptyDatabase = {
  doc() {
    return {
      get: async () => ({ exists: false, data: () => null }),
      set: async () => undefined,
    };
  },
  collection() {
    return { onSnapshot: (onData: (snap: unknown) => void) => (onData({ docs: [] }), () => undefined) };
  },
};

/**
 * Runs the type test (src/app/[lang]/test/engine, taken unchanged from the
 * test page) inside the app. The test draws its own screens in Arabic; the
 * page around it follows the interface language.
 */
export function TestEngineHost({ userId, isOwner, labels, fixture }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const summarizeRef = useRef<Summarize | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const data =
          fixture?.data ??
          (await fetch("/api/test-data", { credentials: "same-origin" }).then((response) => {
            if (!response.ok) throw new Error(`test data: ${response.status}`);
            return response.json() as Promise<Doc>;
          }));
        const { startTestEngine } = await import("./engine/engine.js");
        if (cancelled) return;
        const db = fixture ? emptyDatabase : databaseFor(() => summarizeRef.current);
        const env = {
          storageKey: `sajiyya_test_${userId}${isOwner ? "_owner" : ""}`,
          ready: (api: { summarize: Summarize }) => {
            summarizeRef.current = api.summarize;
          },
          use: async (name: string) =>
            name === "user"
              ? { isOwner: async () => isOwner, id: async () => userId }
              : name === "db"
                ? db
                : null,
        };
        setState("ready");
        stop = startTestEngine(env, data);
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId, isOwner, fixture]);

  return (
    <div className="test-engine" lang="ar" dir="rtl">
      <div className="wrap">
        <header className="grid gap-1.5">
          <p id="sub" className="note" />
        </header>
        <div id="timerBar" className="timer hide">
          <span>{labels.timeLeft}</span>
          <b id="timerVal">45:00</b>
        </div>
        <div id="main" />
        {state === "loading" && (
          <p className="flex items-center gap-2 text-muted" role="status">
            <LoaderCircle size={18} aria-hidden className="animate-spin" />
            {labels.loading}
          </p>
        )}
        {state === "error" && (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4" role="alert">
            <TriangleAlert size={18} aria-hidden className="shrink-0 text-accent" />
            {labels.loadError}
          </p>
        )}
      </div>
    </div>
  );
}
