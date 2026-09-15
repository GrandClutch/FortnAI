import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const appDir = process.cwd();
const backendDir = resolve(appDir, "..", "backend");
const executable = join(
  backendDir,
  process.platform === "win32" ? "pocketbase.exe" : "pocketbase"
);
const nextCLI = join(appDir, "node_modules", "next", "dist", "bin", "next");
const healthURL = "http://127.0.0.1:8090/api/health";

async function isPocketBaseHealthy() {
  try {
    const response = await fetch(healthURL, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPocketBase(child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await isPocketBaseHealthy()) return true;
    if (child?.exitCode !== null && child?.exitCode !== undefined) return false;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  return false;
}

if (!existsSync(executable)) {
  console.error(`PocketBase executable not found at ${executable}`);
  process.exit(1);
}

if (!existsSync(nextCLI)) {
  console.error(`Next.js CLI not found at ${nextCLI}. Run npm install first.`);
  process.exit(1);
}

let pocketbase = null;
let startedPocketBase = false;
let shuttingDown = false;

if (!(await isPocketBaseHealthy())) {
  console.log("Starting PocketBase...");
  pocketbase = spawn(executable, ["serve", "--http=127.0.0.1:8090"], {
    cwd: backendDir,
    stdio: "inherit",
    windowsHide: false,
  });
  startedPocketBase = true;

  pocketbase.once("error", (error) => {
    console.error("Unable to start PocketBase:", error);
  });

  if (!(await waitForPocketBase(pocketbase))) {
    console.error("PocketBase did not become healthy within 15 seconds.");
    pocketbase.kill();
    process.exit(1);
  }
} else {
  console.log("Using the existing PocketBase process.");
}

console.log("PocketBase is ready. Starting Next.js...");

const next = spawn(process.execPath, [nextCLI, "dev"], {
  cwd: appDir,
  stdio: "inherit",
  windowsHide: false,
});

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!next.killed) next.kill();
  if (startedPocketBase && pocketbase && !pocketbase.killed) pocketbase.kill();
  process.exit(code);
};

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));

next.once("error", (error) => {
  console.error("Unable to start Next.js:", error);
  shutdown(1);
});

next.once("exit", (code) => shutdown(code ?? 0));
