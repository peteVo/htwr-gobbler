import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { crypt } from "../apps/api/security";
import { validateFeed } from "../packages/core/index";

const tables = [
  "users",
  "courses",
  "sources",
  "items",
  "changes",
  "preferences",
  "sessions",
  "api_tokens",
];
export function findDatabase(root: string) {
  const candidates = fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".sqlite") &&
        e.name !== "metadata.sqlite",
    )
    .map((e) => path.join(e.parentPath, e.name))
    .filter((file) => {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        return !!db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
          )
          .get();
      } finally {
        db.close();
      }
    });
  assert.equal(candidates.length, 1, "Expected one local Gobbler database");
  return candidates[0];
}
export async function verifyBackup(directory: string) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "manifest.json"), "utf8"),
  );
  const file = path.join(directory, "workspace.sqlite");
  assert.equal(
    createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    manifest.sha256,
  );
  const secrets = JSON.parse(
    fs.readFileSync(path.join(directory, "secrets.json"), "utf8"),
  );
  assert(
    secrets.FEED_SECRET?.length >= 32 && secrets.SESSION_SECRET?.length >= 32,
  );
  const restored = path.join(directory, "restore-check.sqlite");
  fs.copyFileSync(file, restored);
  const db = new DatabaseSync(restored, { readOnly: true });
  try {
    assert.equal(
      Object.values(db.prepare("PRAGMA integrity_check").get()!)[0],
      "ok",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    for (const table of tables) {
      assert.equal(
        db.prepare("SELECT COUNT(*) AS n FROM " + table).get()!.n,
        manifest.counts[table],
      );
    }
    for (const row of db
      .prepare("SELECT feed_cipher FROM sources WHERE feed_cipher IS NOT NULL")
      .all()) {
      validateFeed(
        await crypt(String(row.feed_cipher), secrets.FEED_SECRET, true),
      );
    }
    return manifest;
  } finally {
    db.close();
    fs.unlinkSync(restored);
  }
}
export async function createBackup(
  file: string,
  root: string,
  secrets: { SESSION_SECRET: string; FEED_SECRET: string },
  now = new Date(),
) {
  fs.mkdirSync(root, { recursive: true });
  const name = now.toISOString().replaceAll(":", "-");
  const directory = path.join(root, ".pending-" + name);
  fs.mkdirSync(directory);
  try {
    const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
    try {
      await backup(db, path.join(directory, "workspace.sqlite"));
    } finally {
      db.close();
    }
    const snapshot = new DatabaseSync(
      path.join(directory, "workspace.sqlite"),
      { readOnly: true },
    );
    let counts;
    try {
      counts = Object.fromEntries(
        tables.map((table) => [
          table,
          snapshot.prepare("SELECT COUNT(*) AS n FROM " + table).get()!.n,
        ]),
      );
    } finally {
      snapshot.close();
    }
    const manifest = {
      created_at: now.toISOString(),
      counts,
      sha256: createHash("sha256")
        .update(fs.readFileSync(path.join(directory, "workspace.sqlite")))
        .digest("hex"),
    };
    fs.writeFileSync(
      path.join(directory, "secrets.json"),
      JSON.stringify(secrets),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify(manifest),
    );
    await verifyBackup(directory);
    fs.renameSync(directory, path.join(root, name));
    const completed = fs
      .readdirSync(root)
      .filter((n) => /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z$/.test(n))
      .sort()
      .reverse();
    for (const old of completed.slice(7)) {
      const target = path.resolve(root, old);
      assert.equal(path.dirname(target), path.resolve(root));
      if (
        fs.lstatSync(target).isDirectory() &&
        !fs.lstatSync(target).isSymbolicLink()
      )
        fs.rmSync(target, { recursive: true });
    }
    return manifest;
  } catch (error) {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(root));
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
