import {
  parseCalendar,
  validateFeed,
  itemChangeKind,
} from "../../packages/core/index";
import { crypt, hash } from "./security";
export async function acquireSource(db: D1Database, user: string, id: string) {
  const result = await db
    .prepare(
      "UPDATE sources SET status='syncing',last_attempt=? WHERE id=? AND user_id=? AND (status!='syncing' OR last_attempt IS NULL OR last_attempt<?)",
    )
    .bind(
      new Date().toISOString(),
      id,
      user,
      new Date(Date.now() - 120000).toISOString(),
    )
    .run();
  return result.meta.changes > 0;
}
export async function ingest(
  db: D1Database,
  user: string,
  source: string,
  text: string,
) {
  const events = parseCalendar(text);
  const overlap = await db
    .prepare(
      "SELECT id FROM items WHERE user_id=? AND source_id IS NOT NULL AND source_id!=? AND external_id IN (SELECT value FROM json_each(?)) LIMIT 1",
    )
    .bind(user, source, JSON.stringify(events.map((e) => e.external_id)))
    .first();
  if (overlap)
    throw new Error(
      "These events already belong to another calendar. Connect the feed by replacing its existing file source; no events were imported.",
    );
  const now = new Date().toISOString();
  const existing = (
    await db
      .prepare(
        "SELECT id, external_id, content_hash,starts_at,all_day FROM items WHERE user_id=? AND source_id=?",
      )
      .bind(user, source)
      .all<{
        id: string;
        external_id: string;
        content_hash: string;
        starts_at: string;
        all_day: number;
      }>()
  ).results;
  const statements: D1PreparedStatement[] = [];
  const courses = new Map(
    (
      await db
        .prepare("SELECT id,name FROM courses WHERE user_id=?")
        .bind(user)
        .all<{ id: string; name: string }>()
    ).results.map((course) => [course.name.toLowerCase(), course.id]),
  );
  let changed = 0;
  for (const e of events) {
    let courseId: string | null = null;
    if (e.course_name) {
      const key = e.course_name.toLowerCase();
      courseId =
        courses.get(key) ||
        "ics-course-" + (await hash(JSON.stringify([user, key])));
      if (!courses.has(key)) {
        statements.push(
          db
            .prepare(
              "INSERT INTO courses (id,user_id,name,code,color) VALUES (?,?,?,'','sage') ON CONFLICT(id) DO NOTHING",
            )
            .bind(courseId, user, e.course_name),
        );
        courses.set(key, courseId);
      }
    }
    const digest = await hash(JSON.stringify(e));
    const old = existing.find((i) => i.external_id === e.external_id);
    if (old?.content_hash === digest) {
      statements.push(
        db
          .prepare(
            "UPDATE items SET last_verified=?,course_id=COALESCE(course_id,?) WHERE id=? AND user_id=?",
          )
          .bind(now, courseId, old.id, user),
      );
      continue;
    }
    changed++;
    const id = old?.id || crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO items (id,user_id,source_id,external_id,title,description,kind,starts_at,ends_at,all_day,verification,source_url,last_verified,content_hash,status,course_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET course_id=COALESCE(items.course_id,excluded.course_id),title=excluded.title,description=excluded.description,kind=excluded.kind,starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,source_url=excluded.source_url,last_verified=excluded.last_verified,content_hash=excluded.content_hash,verification='confirmed',status=CASE WHEN excluded.status='dismissed' THEN 'dismissed' ELSE items.status END`,
        )
        .bind(
          id,
          user,
          source,
          e.external_id,
          e.title,
          e.description,
          e.kind,
          e.starts_at,
          e.ends_at,
          Number(e.all_day),
          "confirmed",
          e.source_url,
          now,
          digest,
          e.cancelled ? "dismissed" : "open",
          courseId,
        ),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO changes (id,user_id,item_id,title,kind,created_at,previous_starts_at,next_starts_at,previous_all_day,next_all_day) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user,
          id,
          e.title,
          itemChangeKind(old, e),
          now,
          old?.starts_at ?? null,
          e.starts_at,
          old?.all_day ?? null,
          Number(e.all_day),
        ),
    );
  }
  // shortcut: absence from a rolling feed does not prove deletion; require explicit cancellation until a complete snapshot contract exists.
  statements.push(
    db
      .prepare(
        "UPDATE sources SET status='connected',last_attempt=?,last_success=?,error=NULL,imported_count=? WHERE id=? AND user_id=?",
      )
      .bind(now, now, events.length, source, user),
  );
  await db.batch(statements);
  return { imported: events.length, changed };
}
export async function syncFeed(
  db: D1Database,
  source: { id: string; user_id: string; feed_cipher: string },
  secret: string,
) {
  if (!(await acquireSource(db, source.user_id, source.id)))
    throw new Error("A source check is already running.");
  try {
    const url = validateFeed(await crypt(source.feed_cipher, secret, true));
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(url, {
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: { Accept: "text/calendar" },
        });
      } catch (error) {
        if (attempt === 1) throw error;
        continue;
      }
      if (response.ok || response.status < 500) break;
    }
    if (!response?.ok)
      throw new Error(
        "The calendar could not be retrieved. Check the export link in Moodle.",
      );
    if (Number(response.headers.get("content-length")) > 2_000_000)
      throw new Error("Calendar exceeds the 2 MB import limit.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The calendar response was empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error("Calendar exceeds the 2 MB import limit.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return await ingest(
      db,
      source.user_id,
      source.id,
      new TextDecoder().decode(bytes),
    );
  } catch {
    // Do not echo fetch exceptions: they can contain the secret calendar URL.
    await db
      .prepare("UPDATE sources SET status='failed',error=? WHERE id=?")
      .bind(
        "Calendar check failed. Previous records are retained. Check for overlapping calendars, or connect the feed by replacing its existing file source. Verify the feed uses a supported, non-recurring export.",
        source.id,
      )
      .run();
    throw new Error(
      "Calendar check failed. Previous information may be outdated.",
    );
  }
}
