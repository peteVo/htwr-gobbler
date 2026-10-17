import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getPlatformProxy } from "wrangler";
import { z } from "zod";
import { checkSources } from "../apps/api/sync";
import { createBackup, findDatabase, verifyBackup } from "./backup";

const root = path.resolve(import.meta.dirname, ".."),
  local = path.join(root, ".wrangler", "local");
process.chdir(root);
if (process.argv[2] === "--backup") {
  const proxy = await getPlatformProxy<{
    DB: D1Database;
    SESSION_SECRET: string;
    FEED_SECRET: string;
  }>({ remoteBindings: false });
  try {
    const result = await createBackup(
      findDatabase(path.join(root, ".wrangler/state/v3/d1")),
      path.join(local, "manual-backups"),
      {
        SESSION_SECRET: proxy.env.SESSION_SECRET,
        FEED_SECRET: proxy.env.FEED_SECRET,
      },
    );
    console.log(
      JSON.stringify({ verified: true, created_at: result.created_at }),
    );
  } finally {
    await proxy.dispose();
  }
  process.exit(0);
}
if (process.argv[2] === "--verify") {
  const result = await verifyBackup(path.resolve(process.argv[3]));
  console.log(
    JSON.stringify({
      verified: true,
      created_at: result.created_at,
      counts: result.counts,
    }),
  );
  process.exit(0);
}
const { user_id } = z
  .object({ user_id: z.string().uuid() })
  .parse(JSON.parse(fs.readFileSync(path.join(local, "config.json"), "utf8")));
const lock = path.join(local, "runner.lock");
if (fs.existsSync(lock)) {
  const pid = Number(fs.readFileSync(lock, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if (alive) process.exit(0);
  fs.unlinkSync(lock);
}
fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
const statusPath = path.join(local, "status.json");
const previous = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};
const status = {
  heartbeat: "",
  last_check: previous.last_check ?? null,
  check_failed: previous.check_failed ?? false,
  last_backup: previous.last_backup ?? null,
  backup_failed: previous.backup_failed ?? false,
};
function writeStatus() {
  status.heartbeat = new Date().toISOString();
  fs.writeFileSync(statusPath + ".tmp", JSON.stringify(status));
  fs.renameSync(statusPath + ".tmp", statusPath);
}
writeStatus();
const children: ReturnType<typeof spawn>[] = [];
const log = fs.openSync(path.join(local, "runtime.log"), "a");
async function ensureServer(
  port: number,
  route: string,
  marker: string,
  command: string[],
) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok || !(await response.text()).includes(marker))
      throw new Error("Port is used by another application");
    return;
  } catch (error) {
    if (
      !(error instanceof TypeError) &&
      (error as Error).name !== "TimeoutError"
    )
      throw error;
  }
  const child = spawn(process.execPath, command, {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  children.push(child);
  child.on("error", () => {
    console.error(
      "Gobbler could not start a local server. See the local runtime log.",
    );
    void stop(1);
  });
  child.on("exit", () => {
    if (!stopping) void stop(1);
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode !== null) throw new Error("Local server exited");
    try {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok && (await response.text()).includes(marker)) return;
    } catch {
      /* Wait for the local server to become ready. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local server did not become ready");
}
let proxy:
  | Awaited<
      ReturnType<
        typeof getPlatformProxy<{
          DB: D1Database;
          SESSION_SECRET: string;
          FEED_SECRET: string;
        }>
      >
    >
  | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  status.heartbeat = "1970-01-01T00:00:00.000Z";
  fs.writeFileSync(statusPath, JSON.stringify(status));
  clearTimeout(timer);
  for (const child of children) child.kill();
  await proxy?.dispose();
  if (
    fs.existsSync(lock) &&
    fs.readFileSync(lock, "utf8") === String(process.pid)
  )
    fs.unlinkSync(lock);
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  await ensureServer(8787, "/api/auth/options", "registration_open", [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
  ]);
  await ensureServer(5173, "/", "htwr-gobbler", [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ]);
  proxy = await getPlatformProxy<{
    DB: D1Database;
    SESSION_SECRET: string;
    FEED_SECRET: string;
  }>({ remoteBindings: false });
  if (
    !(await proxy.env.DB.prepare("SELECT id FROM users WHERE id=?")
      .bind(user_id)
      .first())
  )
    throw new Error("Local workspace not found");
  let backupAttempt = 0;
  async function tick() {
    if (stopping || !proxy) return;
    writeStatus();
    if (
      (!status.last_backup ||
        Date.now() - Date.parse(status.last_backup) >= 86400000) &&
      Date.now() - backupAttempt >= 3600000
    ) {
      backupAttempt = Date.now();
      try {
        const result = await createBackup(
          findDatabase(path.join(root, ".wrangler", "state", "v3", "d1")),
          path.join(local, "backups"),
          {
            SESSION_SECRET: proxy.env.SESSION_SECRET,
            FEED_SECRET: proxy.env.FEED_SECRET,
          },
        );
        status.last_backup = result.created_at;
        status.backup_failed = false;
      } catch {
        status.backup_failed = true;
      }
      writeStatus();
    }
    try {
      const result = await checkSources(
        proxy.env.DB,
        proxy.env.FEED_SECRET,
        user_id,
      );
      if (result.attempted) {
        status.last_check = new Date().toISOString();
        status.check_failed = result.failed > 0;
      }
    } catch {
      status.check_failed = true;
    }
    writeStatus();
    if (process.argv.includes("--once")) await stop();
    else timer = setTimeout(tick, 60000);
  }
  await tick();
} catch {
  console.error(
    "Local Gobbler setup failed. Check the local configuration, database and runtime log.",
  );
  await stop(1);
}
