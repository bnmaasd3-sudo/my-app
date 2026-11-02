import type { CapacitorConfig } from "@capacitor/cli";

// The Android app opens the deployed site (sign-in and chapters come from the
// server). Set QARI_URL to the production URL when syncing or building.
// android-shell/ is only shown when the site cannot be reached.
const url = process.env.QARI_URL ?? "https://qari.vercel.app";

const config: CapacitorConfig = {
  appId: "app.qari.reader",
  appName: "قارئ",
  webDir: "android-shell",
  server: {
    url,
    cleartext: false,
    errorPath: "index.html",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
