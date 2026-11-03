import { spawn, type ChildProcess } from "node:child_process";

/**
 * Starts the built app with the visual fixtures switched on, unless
 * VISUAL_BASE_URL points at a server that is already running.
 */
export const PORT = 3123;

let server: ChildProcess | undefined;

async function answers(url: string) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

export async function setup() {
  if (process.env.VISUAL_BASE_URL) return;

  const probe = `http://localhost:${PORT}/ar/visual-fixtures/library`;
  if (await answers(probe)) {
    throw new Error(`Something already answers on port ${PORT} (an old run?). Stop it and run again.`);
  }

  let output = "";
  let exited: number | null = null;
  server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
    env: { ...process.env, VISUAL_FIXTURES: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => (output += chunk));
  server.stderr?.on("data", (chunk) => (output += chunk));
  server.on("exit", (code) => (exited = code ?? 1));

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (exited !== null) {
      throw new Error(`The app stopped (code ${exited}). Did \`npm run build\` run?\n${output}`);
    }
    if (await answers(probe)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error(`The app did not answer at ${probe} within 90s.\n${output}`);
}

export async function teardown() {
  server?.kill();
}
