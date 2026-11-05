"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Laptop,
  List,
  Monitor,
  MonitorSmartphone,
  Moon,
  RectangleHorizontal,
  RectangleVertical,
  Settings2,
  Smartphone,
  Square,
  Sun,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  FONT_SIZES,
  LAYOUTS,
  THEMES,
  WIDTHS,
  isTheme,
  isWidth,
  type FontSize,
  type Layout,
  type Theme,
  type Width,
} from "@/lib/reader-prefs";
import { format } from "@/i18n/format";
import { saveProgress, savePrefs } from "../actions";

export type { FontSize, Layout, Theme } from "@/lib/reader-prefs";

type Props = {
  bookSlug: string;
  /** Language of the book text, for the chapter title in the bar. */
  bookLang: string;
  bookDir: "rtl" | "ltr";
  chapterTitle: string;
  /** The chapter's number in the book, used to save the reading place. */
  position: number;
  /** Its place among the chapters this reader can open, and how many there are. */
  index: number;
  total: number;
  initialRatio: number;
  initialFontSize: FontSize;
  initialTheme: Theme;
  initialLayout: Layout;
  /** Null when the saved choices have no width yet (migration not applied, or never chosen). */
  initialWidth: Width | null;
  labels: Dictionary["reader"];
  backHref: string;
  previousHref: string | null;
  nextHref: string | null;
  /** Chapter list: beside the text on wide screens, in a side panel otherwise. */
  contents: ReactNode;
  children: ReactNode;
};

const THEME_ICONS: Record<Theme, LucideIcon> = { system: Monitor, light: Sun, dark: Moon, sepia: Coffee };
const WIDTH_ICONS: Record<Width, LucideIcon> = { narrow: RectangleVertical, md: Square, wide: RectangleHorizontal };
/** Sepia and the width, kept on the device until the reader_prefs migration is applied. */
const LOCAL_LOOK = "sajiyya_reader_look";
const LAYOUT_ICONS: Record<Layout, LucideIcon> = {
  auto: MonitorSmartphone,
  mobile: Smartphone,
  laptop: Laptop,
};
const FONT_ICON_SIZES: Record<FontSize, number> = { sm: 14, md: 18, lg: 22 };
const SAVE_DELAY_MS = 1500;

// Arrow icons are drawn for English; Arabic mirrors them, so "back" and
// "previous" point to the start of the line and "next" to its end.
const FLIP = "rtl:-scale-x-100";

function scrollRatio() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
}

export function ReaderFrame({
  bookSlug,
  bookLang,
  bookDir,
  chapterTitle,
  position,
  index,
  total,
  initialRatio,
  initialFontSize,
  initialTheme,
  initialLayout,
  initialWidth,
  labels,
  backHref,
  previousHref,
  nextHref,
  contents,
  children,
}: Props) {
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [theme, setTheme] = useState(initialTheme);
  const [layout, setLayout] = useState(initialLayout);
  const [width, setWidth] = useState<Width>(initialWidth ?? "md");
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialRatio);
  const contentsDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);

  // Return to where the reader stopped, then save the position as they scroll.
  useEffect(() => {
    lastSaved.current = initialRatio;
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

  // Without a width in the saved choices, sepia and the width come from this device.
  useEffect(() => {
    if (initialWidth !== null) return;
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_LOOK) ?? "{}") as { theme?: unknown; width?: unknown };
      // Known only in the browser, so set after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isWidth(local.width)) setWidth(local.width);
      if (isTheme(local.theme) && local.theme === "sepia") setTheme("sepia");
    } catch {
      // Storage blocked or unreadable: the saved choices stand.
    }
  }, [initialWidth]);

  // A new chapter closes any open panel.
  useEffect(() => {
    contentsDialog.current?.close();
    settingsDialog.current?.close();
  }, [position]);

  const update = (next: { fontSize?: FontSize; theme?: Theme; layout?: Layout; width?: Width }) => {
    const prefs = {
      fontSize: next.fontSize ?? fontSize,
      theme: next.theme ?? theme,
      layout: next.layout ?? layout,
      width: next.width ?? width,
    };
    setFontSize(prefs.fontSize);
    setTheme(prefs.theme);
    setLayout(prefs.layout);
    setWidth(prefs.width);
    try {
      localStorage.setItem(LOCAL_LOOK, JSON.stringify({ theme: prefs.theme, width: prefs.width }));
    } catch {
      // Nothing to keep on this device; the account still saves them.
    }
    startTransition(() => savePrefs(prefs.fontSize, prefs.theme, prefs.layout, prefs.width));
  };

  return (
    <div
      data-reader
      data-font={fontSize}
      data-layout={layout}
      data-width={width}
      data-theme={theme === "system" ? undefined : theme}
      className="min-h-dvh bg-background text-foreground"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="reader-bar flex h-16 items-center gap-1">
          <IconLink href={backHref} label={labels.back}>
            <ArrowLeft className={FLIP} />
          </IconLink>
          <IconButton
            className="reader-contents-button"
            label={labels.contents}
            onClick={() => contentsDialog.current?.showModal()}
          >
            <List />
          </IconButton>

          <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
            <p
              lang={bookLang}
              dir={bookDir}
              className="w-full truncate font-heading text-sm leading-6 font-semibold"
            >
              {chapterTitle}
            </p>
            <p className="text-[0.7rem] leading-4 text-muted">
              {format(labels.chapterOf, { n: index, total })}
            </p>
          </div>

          <IconLink href={previousHref} label={labels.previous}>
            <ChevronLeft className={FLIP} />
          </IconLink>
          <IconLink href={nextHref} label={labels.next}>
            <ChevronRight className={FLIP} />
          </IconLink>
          <IconButton label={labels.settings} onClick={() => settingsDialog.current?.showModal()}>
            <Settings2 />
          </IconButton>
        </div>
        <ProgressBar label={labels.progress} position={position} />
      </header>

      <div className="reader-shell">
        <aside className="reader-sidebar">{contents}</aside>
        <div className="reader-column">{children}</div>
      </div>

      <Panel
        ref={contentsDialog}
        kind="drawer"
        title={labels.contents}
        closeLabel={labels.close}
      >
        {contents}
      </Panel>

      <Panel ref={settingsDialog} kind="sheet" title={labels.settings} closeLabel={labels.close}>
        <div className="flex flex-col gap-6">
          <Choice
            legend={labels.fontSize}
            options={FONT_SIZES.map((value) => ({
              value,
              label: labels.fontSizes[value],
              icon: <Type size={FONT_ICON_SIZES[value]} aria-hidden />,
            }))}
            value={fontSize}
            onChange={(value) => update({ fontSize: value })}
          />
          <Choice
            legend={labels.theme}
            options={THEMES.map((value) => {
              const Icon = THEME_ICONS[value];
              return { value, label: labels.themes[value], icon: <Icon size={18} aria-hidden /> };
            })}
            value={theme}
            onChange={(value) => update({ theme: value })}
          />
          <Choice
            legend={labels.layout}
            options={LAYOUTS.map((value) => {
              const Icon = LAYOUT_ICONS[value];
              return { value, label: labels.layouts[value], icon: <Icon size={18} aria-hidden /> };
            })}
            value={layout}
            onChange={(value) => update({ layout: value })}
          />
          <Choice
            legend={labels.width}
            options={WIDTHS.map((value) => {
              const Icon = WIDTH_ICONS[value];
              return { value, label: labels.widths[value], icon: <Icon size={18} aria-hidden /> };
            })}
            value={width}
            onChange={(value) => update({ width: value })}
          />
        </div>
      </Panel>
    </div>
  );
}

/** How far through this chapter the reader is. Only this bar re-renders on scroll. */
function ProgressBar({ label, position }: { label: string; position: number }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPercent(Math.round(scrollRatio() * 100)));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [position]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-0.5 w-full bg-border/60"
    >
      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

const iconClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-5";

function IconLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled className={`${iconClass} opacity-30`} title={label}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link prefetch={false} href={href} aria-label={label} title={label} className={iconClass}>
      {children}
    </Link>
  );
}

function IconButton({
  label,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`${iconClass} ${className}`}>
      {children}
    </button>
  );
}

/**
 * A modal panel: the chapter list slides in from the start side; the settings
 * open as a sheet from the bottom on phones and a card on wider screens.
 * Tapping outside it, a link inside it, or Escape closes it.
 */
function Panel({
  ref,
  kind,
  title,
  closeLabel,
  children,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  kind: "drawer" | "sheet";
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    const target = event.target as Element;
    if (target === event.currentTarget || target.closest("a")) event.currentTarget.close();
  };

  const placement =
    kind === "drawer"
      ? "reader-drawer inset-y-0 start-0 end-auto h-dvh max-h-none w-[min(22rem,88vw)] border-e"
      : "reader-sheet inset-x-0 top-auto bottom-0 mx-auto max-h-[85dvh] w-full max-w-lg rounded-t-3xl border-t sm:inset-x-auto sm:top-16 sm:bottom-auto sm:end-4 sm:m-0 sm:w-80 sm:rounded-3xl sm:border";

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={onClick}
      className={`reader-panel fixed m-0 max-w-none overflow-hidden border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-scrim backdrop:backdrop-blur-[2px] ${placement}`}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <p className="font-heading font-semibold">{title}</p>
          <button
            type="button"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={() => ref.current?.close()}
            className={iconClass}
          >
            <X />
          </button>
        </div>
        <div className={`overflow-y-auto overscroll-contain p-4 ${kind === "sheet" ? "pb-8" : "flex-1"}`}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string; icon: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-heading text-sm text-muted">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border text-sm transition-colors hover:bg-background aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent"
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
