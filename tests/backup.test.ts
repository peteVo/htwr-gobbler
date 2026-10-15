import { test, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createBackup, findDatabase, verifyBackup } from "../scripts/backup";
import { crypt } from "../apps/api/security";

test("online backups restore data and feed credentials, reject corruption and retain seven verified copies", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gobbler-backup-")),
    file = path.join(root, "live.sqlite"),
    copies = path.join(root, "backups");
  const secrets = {
    SESSION_SECRET: "test-session-secret-".repeat(3),
    FEED_SECRET: "test-feed-secret-".repeat(3),
  };
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA journal_mode=WAL");
    for (const migration of fs
      .readdirSync("migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort())
      db.exec(fs.readFileSync("migrations/" + migration, "utf8"));
    db.prepare(
      "INSERT INTO users (id,email,password_hash,salt,created_at,recovery_hash) VALUES ('u','backup@test.invalid','password-hash','salt','2026-10-15','recovery-hash')",
    ).run();
    db.prepare(
      "INSERT INTO sources (id,user_id,name,kind,feed_cipher) VALUES ('s','u','Calendar','feed',?)",
    ).run(
      await crypt(
        "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=synthetic",
        secrets.FEED_SECRET,
      ),
    );
    db.prepare(
      "INSERT INTO items (id,user_id,title,kind,starts_at,status,verification) VALUES ('i','u','Saved task','assignment','2026-10-22T10:00:00.000Z','done','confirmed')",
    ).run();
    expect(findDatabase(root)).toBe(file);
    for (let day = 1; day <= 8; day++)
      await createBackup(
        file,
        copies,
        secrets,
        new Date(Date.UTC(2026, 9, day)),
      );
    const names = fs.readdirSync(copies).sort();
    expect(names).toHaveLength(7);
    const latest = path.join(copies, names.at(-1)!);
    expect((await verifyBackup(latest)).counts.items).toBe(1);
    const restored = new DatabaseSync(path.join(latest, "workspace.sqlite"), {
      readOnly: true,
    });
    expect(restored.prepare("SELECT status FROM items").get()!.status).toBe(
      "done",
    );
    expect(
      restored.prepare("SELECT recovery_hash FROM users").get()!.recovery_hash,
    ).toBe("recovery-hash");
    restored.close();
    await expect(
      createBackup(
        file,
        copies,
        { ...secrets, FEED_SECRET: "wrong-key-".repeat(5) },
        new Date(Date.UTC(2026, 9, 9)),
      ),
    ).rejects.toThrow();
    expect(fs.readdirSync(copies)).toHaveLength(7);
    fs.appendFileSync(path.join(latest, "workspace.sqlite"), "corruption");
    await expect(verifyBackup(latest)).rejects.toThrow();
    expect(db.prepare("SELECT COUNT(*) AS n FROM items").get()!.n).toBe(1);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
