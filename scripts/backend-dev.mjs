import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const backendDir = resolve(process.cwd(), "..", "backend");
const executable = join(
  backendDir,
  process.platform === "win32" ? "pocketbase.exe" : "pocketbase"
);

if (!existsSync(executable)) {
  console.error(`PocketBase executable not found at ${executable}`);
  process.exit(1);
}

const pocketbase = spawn(executable, ["serve", "--http=127.0.0.1:8090"], {
  cwd: backendDir,
  stdio: "inherit",
  windowsHide: false,
});

const stop = () => {
  if (!pocketbase.killed) pocketbase.kill();
};

process.once("SIGINT", () => {
  stop();
  process.exit(130);
});

process.once("SIGTERM", () => {
  stop();
  process.exit(143);
});

pocketbase.once("error", (error) => {
  console.error("Unable to start PocketBase:", error);
  process.exit(1);
});

pocketbase.once("exit", (code, signal) => {
  if (code !== 0 && signal !== "SIGTERM") {
    console.error(`PocketBase stopped unexpectedly (${signal ?? `code ${code}`}).`);
  }
  process.exit(code ?? 0);
});
