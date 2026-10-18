import { localQueries } from "../apps/api/local-queries";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { materialInput } from "../packages/core/materials";
import {
  extractExplicitDeadlines,
  type DocumentPage,
} from "../packages/core/deadlines";
import { hash } from "../apps/api/security";

export const folderInput = z.object({
  course_id: z.string().min(1).max(100),
  path: z.string().min(1),
  source_id: z.string().min(1),
});
export type MaterialFolder = z.infer<typeof folderInput>;
const root = path.resolve(import.meta.dirname, "..");

export async function readLocalPdf(data: Buffer): Promise<DocumentPage[]> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [
        "--max-old-space-size=256",
        "--import",
        "tsx",
        path.join(root, "scripts/material-pdf.ts"),
      ],
      { timeout: 30000, maxBuffer: 3_000_000, windowsHide: true, cwd: root },
      (error, stdout) => {
        if (error)
          return reject(
            new Error("PDF could not be read within the local limits"),
          );
        try {
          resolve(
            materialInput.parse({
              course_id: "local",
              name: "PDF",
              source_url: "",
              pages: JSON.parse(stdout),
            }).pages,
          );
        } catch {
          reject(new Error("PDF contains no supported text"));
        }
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(data);
  });
}

export async function connectMaterialFolder(
  db: D1Database,
  user: string,
  course: string,
  directory: string,
): Promise<MaterialFolder> {
  const canonical = await fs.realpath(path.resolve(directory));
  if (!(await fs.stat(canonical)).isDirectory())
    throw new Error("Choose a course folder");
  const owned = await db
    .prepare(localQueries.courseName)
    .bind(course, user)
    .first<{ name: string }>();
  if (!owned) throw new Error("Course not found");
  const source_id =
    "folder-" +
    (await hash(
      JSON.stringify([
        user,
        course,
        process.platform === "win32" ? canonical.toLowerCase() : canonical,
      ]),
    ));
  await db
    .prepare(localQueries.connectSource)
    .bind(source_id, user, "Local files · " + owned.name)
    .run();
  return { course_id: course, path: canonical, source_id };
}

export async function syncMaterialFolder(
  db: D1Database,
  user: string,
  folder: MaterialFolder,
  read = readLocalPdf,
  now = Date.now(),
) {
  if (
    !(await db
      .prepare(localQueries.source)
      .bind(folder.source_id, user)
      .first())
  )
    return;
  if (
    !(await db
      .prepare(localQueries.ownedCourse)
      .bind(folder.course_id, user)
      .first())
  )
    return;
  const stamp = new Date(now).toISOString();
  await db
    .prepare(localQueries.attempt)
    .bind(stamp, folder.source_id, user)
    .run();
  let failed = false,
    complete = true,
    parsed = 0,
    entries = 0;
  const found = new Set<string>();
  try {
    const base = await fs.realpath(folder.path);
    // Do not follow a replaced root or links into unrelated folders.
    if (base !== folder.path || (await fs.lstat(folder.path)).isSymbolicLink())
      throw new Error("Folder changed");
    async function walk(directory: string, depth: number) {
      if (depth > 20) throw new Error("Folder nesting limit");
      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        if (++entries > 3000) throw new Error("Folder entry limit");
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          await walk(file, depth + 1);
          continue;
        }
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf"))
          continue;
        const relative = path.relative(base, file);
        found.add(relative);
        let fileHash = "";
        try {
          const canonical = await fs.realpath(file);
          const inside = path.relative(base, canonical);
          if (inside.startsWith("..") || path.isAbsolute(inside))
            throw new Error("File outside folder");
          const before = await fs.stat(file);
          if (before.size > 10_000_000) throw new Error("PDF exceeds 10 MB");
          if (now - before.mtimeMs < 5000) {
            complete = false;
            await db
              .prepare(localQueries.unavailableFile)
              .bind(user, folder.source_id, relative)
              .run();
            continue;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of createReadStream(canonical)) {
            bytes += chunk.length;
            if (bytes > 10_000_000) throw new Error("PDF exceeds 10 MB");
            chunks.push(chunk as Buffer);
          }
          const data = Buffer.concat(chunks);
          fileHash = createHash("sha256").update(data).digest("hex");
          const previous = await db
            .prepare(localQueries.file)
            .bind(user, folder.source_id, relative)
            .first<{
              file_hash: string;
              state: string;
              material_id: string | null;
              checked_at: number;
            }>();
          if (
            previous?.file_hash === fileHash &&
            previous.state === "available" &&
            previous.material_id
          )
            continue;
          // Bad PDFs must not consume every pass and starve later downloads.
          if (
            previous?.file_hash === fileHash &&
            previous.state === "unreadable" &&
            now - previous.checked_at < 600000
          ) {
            failed = true;
            continue;
          }
          if (parsed >= 3) {
            complete = false;
            await db
              .prepare(localQueries.unavailableFile)
              .bind(user, folder.source_id, relative)
              .run();
            continue;
          }
          parsed++;
          const pages = await read(data);
          materialInput.parse({
            course_id: folder.course_id,
            name: entry.name,
            source_url: "",
            pages,
          });
          const after = await fs.stat(file);
          if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw new Error("PDF is still changing");
          const text = JSON.stringify(pages),
            contentHash = await hash(text);
          const documentHash = await hash(
            pages
              .map((p) => p.text)
              .join("\n\n")
              .replace(/\s+/g, " ")
              .trim(),
          );
          const candidates = await Promise.all(
            extractExplicitDeadlines(pages, entry.name)
              .slice(0, 50)
              .map(async (d) => ({
                ...d,
                course_id: folder.course_id,
                source_url: "",
                document_name: entry.name,
                document_hash: documentHash,
                document_key: await hash(
                  JSON.stringify([
                    documentHash,
                    d.page,
                    d.deadline,
                    d.evidence.replace(/\s+/g, " ").trim(),
                  ]),
                ),
              })),
          );
          const id =
            "material-" +
            (await hash(JSON.stringify([user, folder.course_id, contentHash])));
          await db
            .prepare(localQueries.saveMaterial)
            .bind(
              id,
              user,
              folder.course_id,
              entry.name,
              text,
              contentHash,
              stamp,
              JSON.stringify(candidates),
              user,
              user,
            )
            .run();
          const saved = await db
            .prepare(localQueries.material)
            .bind(user, folder.course_id, contentHash)
            .first<{ id: string }>();
          if (!saved) throw new Error("Material library is full");
          await db
            .prepare(localQueries.bindFile)
            .bind(user, folder.source_id, relative, saved.id, fileHash)
            .run();
        } catch {
          failed = true;
          await db
            .prepare(localQueries.failedFile)
            .bind(user, folder.source_id, relative, fileHash, now)
            .run();
        }
      }
    }
    await walk(base, 0);
    if (complete) {
      const rows = await db
        .prepare(localQueries.files)
        .bind(user, folder.source_id)
        .all<{ relative_path: string }>();
      for (const row of rows.results)
        if (!found.has(row.relative_path))
          await db
            .prepare(localQueries.missingFile)
            .bind(user, folder.source_id, row.relative_path)
            .run();
    }
  } catch {
    failed = true;
    await db
      .prepare(localQueries.unavailableFolder)
      .bind(user, folder.source_id)
      .run();
  }
  // Retain missing files for recovery; discard only superseded, unreferenced automatic text.
  await db.prepare(localQueries.discardSuperseded).bind(user).run();
  const count = await db
    .prepare(localQueries.countFiles)
    .bind(user, folder.source_id)
    .first<{ n: number }>();
  await db
    .prepare(localQueries.sourceStatus)
    .bind(
      failed || !complete ? "failed" : "connected",
      failed || !complete ? 1 : 0,
      stamp,
      failed
        ? "Some local PDFs could not be read. Check folder access, readable text and library limits."
        : !complete
          ? "Local import is catching up. Another check follows shortly."
          : null,
      count?.n ?? 0,
      folder.source_id,
      user,
    )
    .run();
  return { failed, pending: !complete, imported: count?.n ?? 0 };
}
