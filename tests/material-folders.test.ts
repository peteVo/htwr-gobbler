import { test, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  connectMaterialFolder,
  syncMaterialFolder,
  readLocalPdf,
} from "../scripts/material-folders";
import { availableMaterial } from "../packages/core/materials";

test("local folder sync preserves module ownership, deduplicates renames, replaces revisions and excludes missing/unreadable files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gobbler-folder-"));
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const migration of (await fs.readdir("migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      sqlite.exec(await fs.readFile("migrations/" + migration, "utf8"));
    sqlite.exec(
      "INSERT INTO users (id,email,password_hash,salt,created_at) VALUES ('u','one@test.invalid','hash','salt','now'),('other','other@test.invalid','hash','salt','now'); INSERT INTO courses VALUES ('c','u','Networks','NET','sage'),('other-course','other','Private','P','sage')",
    );
    const db = {
      prepare(sql: string) {
        let args: any[] = [];
        const statement = {
          bind(...v: any[]) {
            args = v;
            return statement;
          },
          async first() {
            return sqlite.prepare(sql).get(...args) ?? null;
          },
          async all() {
            return { results: sqlite.prepare(sql).all(...args) };
          },
          async run() {
            return {
              meta: {
                changes: Number(sqlite.prepare(sql).run(...args).changes),
              },
            };
          },
        };
        return statement;
      },
    } as unknown as D1Database;
    await expect(
      connectMaterialFolder(db, "u", "other-course", directory),
    ).rejects.toThrow("Course not found");
    const folder = await connectMaterialFolder(db, "u", "c", directory);
    expect(
      (await connectMaterialFolder(db, "u", "c", directory)).source_id,
    ).toBe(folder.source_id);
    const future = Date.now() + 60000;
    let reads = 0;
    const read = async (data: Buffer) => {
      reads++;
      if (data.toString() === "bad") throw Error("Malformed");
      return [{ page: 1, text: data.toString() }];
    };
    const first =
      "Abgabe bis zum 22.10.2026 um 14:00. TCP uses acknowledgements.";
    await fs.writeFile(path.join(directory, "sheet.pdf"), first);
    await syncMaterialFolder(db, "other", folder, read, future);
    expect(
      sqlite.prepare("SELECT COUNT(*) n FROM material_files").get()?.n,
    ).toBe(0);
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(reads).toBe(1);
    const original = sqlite.prepare("SELECT * FROM materials").get()!;
    expect(JSON.parse(String(original.candidates))).toHaveLength(1);
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(reads).toBe(1);
    await fs.rename(
      path.join(directory, "sheet.pdf"),
      path.join(directory, "renamed.pdf"),
    );
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(sqlite.prepare("SELECT COUNT(*) n FROM materials").get()?.n).toBe(1);
    expect(
      sqlite
        .prepare(
          "SELECT state FROM material_files WHERE relative_path='sheet.pdf'",
        )
        .get()?.state,
    ).toBe("missing");
    await fs.writeFile(path.join(directory, "renamed.pdf"), "bad");
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(
      sqlite
        .prepare("SELECT COUNT(*) n FROM materials WHERE " + availableMaterial)
        .get()?.n,
    ).toBe(0);
    expect(sqlite.prepare("SELECT pages FROM materials").get()?.pages).toBe(
      original.pages,
    );
    await fs.writeFile(
      path.join(directory, "renamed.pdf"),
      "A revised PDF with a new explanation of TCP.",
    );
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(
      sqlite
        .prepare("SELECT COUNT(*) n FROM materials WHERE " + availableMaterial)
        .get()?.n,
    ).toBe(1);
    expect(
      sqlite
        .prepare("SELECT id FROM materials WHERE " + availableMaterial)
        .get()?.id,
    ).not.toBe(original.id);
    await fs.unlink(path.join(directory, "renamed.pdf"));
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(
      sqlite
        .prepare("SELECT COUNT(*) n FROM materials WHERE " + availableMaterial)
        .get()?.n,
    ).toBe(0);
    for (const name of ["a.pdf", "b.pdf", "c.pdf"])
      await fs.writeFile(path.join(directory, name), "bad");
    await fs.writeFile(
      path.join(directory, "z.pdf"),
      "A valid document after three malformed downloads.",
    );
    await syncMaterialFolder(db, "u", folder, read, future);
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(
      sqlite
        .prepare("SELECT state FROM material_files WHERE relative_path='z.pdf'")
        .get()?.state,
    ).toBe("available");
    await syncMaterialFolder(
      db,
      "u",
      { ...folder, path: path.join(directory, "not-present") },
      read,
      future,
    );
    expect(
      sqlite
        .prepare("SELECT COUNT(*) n FROM materials WHERE " + availableMaterial)
        .get()?.n,
    ).toBe(0);
    // A source disconnected in Gobbler must not be silently recreated by saved runner config.
    sqlite.prepare("DELETE FROM sources WHERE id=?").run(folder.source_id);
    await syncMaterialFolder(db, "u", folder, read, future);
    expect(sqlite.prepare("SELECT COUNT(*) n FROM sources").get()?.n).toBe(0);
  } finally {
    sqlite.close();
    if (
      !path
        .resolve(directory)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + "gobbler-folder-")
    )
      throw new Error("Unexpected test directory");
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("the isolated PDF reader extracts page evidence and rejects broken PDFs", async () => {
  const pages = await readLocalPdf(
    await fs.readFile("tests/fixtures/exercise.pdf"),
  );
  expect(pages[0].page).toBe(1);
  expect(pages[0].text.trim().length).toBeGreaterThan(10);
  await expect(readLocalPdf(Buffer.from("not a PDF"))).rejects.toThrow();
}, 45000);
