"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

type Labels = Dictionary["library"]["install"];
type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISSED = "sajiyya_install_hint_dismissed";

/**
 * A quiet line suggesting the reader add the app to their home screen: a
 * button where the browser offers installing (Android, desktop Chrome), the
 * Share-menu steps on iPhone and iPad, nothing once installed, inside the
 * Android or iOS app, or after "Later".
 */
export function InstallHint({ labels }: { labels: Labels }) {
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {
      // Storage can be blocked; the hint then shows each visit.
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      "Capacitor" in window;
    if (dismissed || standalone) return;

    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    // Known only in the browser (the server cannot tell), so it is set after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (iOS) setMode("ios");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "none") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Nothing to keep; it simply shows again next visit.
    }
    setMode("none");
  };

  return (
    <aside className="flex flex-col gap-3 border-y border-border py-5 text-sm">
      <p>{mode === "ios" ? labels.ios : labels.android}</p>
      <div className="flex items-center gap-5">
        {mode === "prompt" && installEvent && (
          <button
            type="button"
            onClick={() => void installEvent.prompt().then(dismiss, dismiss)}
            className="font-heading text-accent hover:underline"
          >
            {labels.install}
          </button>
        )}
        <button type="button" onClick={dismiss} className="text-muted hover:text-foreground">
          {labels.later}
        </button>
      </div>
    </aside>
  );
}
