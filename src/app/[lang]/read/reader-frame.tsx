"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { saveProgress, savePrefs } from "../actions";

export type FontSize = "sm" | "md" | "lg";
export type Theme = "system" | "light" | "dark";

type Props = {
  bookSlug: string;
  position: number;
  initialRatio: number;
  initialFontSize: FontSize;
  initialTheme: Theme;
  labels: Dictionary["reader"];
  header: ReactNode;
  children: ReactNode;
};

const FONT_SIZES: FontSize[] = ["sm", "md", "lg"];
const THEMES: Theme[] = ["system", "light", "dark"];
const SAVE_DELAY_MS = 1500;

function scrollRatio() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
}

export function ReaderFrame({
  bookSlug,
  position,
  initialRatio,
  initialFontSize,
  initialTheme,
  labels,
  header,
  children,
}: Props) {
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [theme, setTheme] = useState(initialTheme);
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialRatio);

  // Return to where the reader stopped, then save the position as they scroll.
  useEffect(() => {
    if (initialRatio > 0) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: initialRatio * max });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const ratio = scrollRatio();
      if (Math.abs(ratio - lastSaved.current) < 0.01) return;
      lastSaved.current = ratio;
      void saveProgress(bookSlug, position, ratio);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [bookSlug, position, initialRatio]);

  const update = (nextFontSize: FontSize, nextTheme: Theme) => {
    setFontSize(nextFontSize);
    setTheme(nextTheme);
    startTransition(() => savePrefs(nextFontSize, nextTheme));
  };

  return (
    <div
      data-reader
      data-font={fontSize}
      data-theme={theme === "system" ? undefined : theme}
      className="min-h-dvh bg-background text-foreground"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
    >
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          {header}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-border px-3 py-1.5 text-sm">
              {labels.settings}
            </summary>
            <div className="absolute end-0 z-40 mt-2 flex w-64 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
              <Choice
                legend={labels.fontSize}
                options={FONT_SIZES.map((value) => ({ value, label: labels.fontSizes[value] }))}
                value={fontSize}
                onChange={(value) => update(value, theme)}
              />
              <Choice
                legend={labels.theme}
                options={THEMES.map((value) => ({ value, label: labels.themes[value] }))}
                value={theme}
                onChange={(value) => update(fontSize, value)}
              />
            </div>
          </details>
        </div>
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-heading text-sm">{legend}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-full border border-border p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="rounded-full px-2 py-1.5 text-sm aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
