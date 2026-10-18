import { localQueries } from "../apps/api/local-queries";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import {
  readLocalPdf,
  PdfPendingError,
  PdfReadError,
  splitMaterialPages,
} from "./pdf-reader";
export { readLocalPdf } from "./pdf-reader";
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
          if (before.size > 50_000_000) throw new PdfReadError("limits");
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
            if (bytes > 50_000_000) throw new PdfReadError("limits");
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
              issue: string;
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
            previous.issue !== "indexing" &&
            now - previous.checked_at < 600000
          ) {
            failed = true;
            continue;
          }
          if (parsed >= 1) {
            complete = false;
            await db
              .prepare(localQueries.unavailableFile)
              .bind(user, folder.source_id, relative)
              .run();
            continue;
          }
          parsed++;
          const pages = await read(data);
          const after = await fs.stat(file);
          if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw new Error("PDF is still changing");
          const parts = splitMaterialPages(pages),
            ids: string[] = [];
          const documentHash = await hash(
            pages
              .map((p) => p.text)
              .join("\n\n")
              .replace(/\s+/g, " ")
              .trim(),
          );
          for (const part of parts) {
            const name =
              parts.length === 1
                ? entry.name
                : entry.name.slice(0, 205) +
                  ` · Pages ${part[0].page}–${part.at(-1)!.page}`;
            materialInput.parse({
              course_id: folder.course_id,
              name,
              source_url: "",
              pages: part,
            });
            const text = JSON.stringify(part),
              contentHash = await hash(text);
            const candidates = await Promise.all(
              extractExplicitDeadlines(part, entry.name)
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
              (await hash(
                JSON.stringify([user, folder.course_id, contentHash]),
              ));
            await db
              .prepare(localQueries.saveMaterial)
              .bind(
                id,
                user,
                folder.course_id,
                name,
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
            if (!saved) throw new PdfReadError("library_full");
            ids.push(saved.id);
          }
          await db
            .prepare(localQueries.bindFile)
            .bind(
              user,
              folder.source_id,
              relative,
              ids[0],
              fileHash,
              JSON.stringify(ids),
              pages.length,
              pages.length,
            )
            .run();
        } catch (error) {
          if (error instanceof PdfPendingError) {
            complete = false;
            parsed = 1;
            await db
              .prepare(localQueries.pendingFile)
              .bind(
                user,
                folder.source_id,
                relative,
                fileHash,
                now,
                error.done,
                error.total,
              )
              .run();
            continue;
          }
          failed = true;
          if (error instanceof PdfReadError) parsed = 1;
          await db
            .prepare(localQueries.failedFile)
            .bind(
              user,
              folder.source_id,
              relative,
              fileHash,
              now,
              error instanceof PdfReadError ? error.issue : "unreadable",
            )
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
      failed ? "failed" : !complete ? "syncing" : "connected",
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
