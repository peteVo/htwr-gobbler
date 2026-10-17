import { restoreInput } from "../../packages/core/restore";
import { hash } from "./security";

export async function restoreRecords(
  db: D1Database,
  user: string,
  input: unknown,
) {
  const data = restoreInput.parse(input);
  const ids = new Map<string, string>();
  for (const table of ["courses", "sources", "items", "actions"] as const) {
    const existing = await db
      .prepare(`SELECT id FROM ${table} WHERE user_id=?`)
      .bind(user)
      .all<{ id: string }>();
    const owned = new Set(existing.results.map((r) => r.id));
    for (const row of data[table])
      ids.set(
        table + ":" + row.id,
        owned.has(row.id)
          ? row.id
          : "restore-" + (await hash(JSON.stringify([user, table, row.id]))),
      );
  }
  const statements: D1PreparedStatement[] = [],
    types: (keyof typeof data)[] = [];
  const add = (type: keyof typeof data, stmt: D1PreparedStatement) => {
    statements.push(stmt);
    types.push(type);
  };
  const course = (id: string | null) => (id ? ids.get("courses:" + id)! : null);
  for (const c of data.courses)
    add(
      "courses",
      db
        .prepare(
          "INSERT OR IGNORE INTO courses (id,user_id,name,code,color) VALUES (?,?,?,?,?)",
        )
        .bind(ids.get("courses:" + c.id), user, c.name, c.code, c.color),
    );
  for (const s of data.sources)
    add(
      "sources",
      db
        .prepare(
          "INSERT OR IGNORE INTO sources (id,user_id,name,kind,status) VALUES (?,?,?,'file','not_configured')",
        )
        .bind(ids.get("sources:" + s.id), user, s.name),
    );
  for (const i of data.items)
    add(
      "items",
      db
        .prepare(
          "INSERT OR IGNORE INTO items (id,user_id,course_id,source_id,external_id,title,description,kind,starts_at,ends_at,all_day,status,verification,source_url,evidence,last_verified,document_key,document_name,document_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'needs_review',?,?,NULL,?,?,?)",
        )
        .bind(
          ids.get("items:" + i.id),
          user,
          course(i.course_id),
          i.source_id ? ids.get("sources:" + i.source_id) : null,
          i.external_id ?? null,
          i.title,
          i.description,
          i.kind,
          i.starts_at,
          i.ends_at,
          Number(i.all_day),
          i.status,
          i.source_url,
          i.evidence,
          i.document_key ?? null,
          i.document_name ?? null,
          i.document_hash ?? null,
        ),
    );
  for (const a of data.actions)
    add(
      "actions",
      db
        .prepare(
          "INSERT OR IGNORE INTO actions (id,user_id,course_id,title,notes,source_url,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          ids.get("actions:" + a.id),
          user,
          course(a.course_id),
          a.title,
          a.notes,
          a.source_url,
          a.status,
          new Date().toISOString(),
        ),
    );
  const results = statements.length ? await db.batch(statements) : [];
  const added = { courses: 0, sources: 0, items: 0, actions: 0 };
  results.forEach((r, i) => {
    added[types[i]] += r.meta.changes;
  });
  return {
    added,
    skipped:
      statements.length - Object.values(added).reduce((sum, n) => sum + n, 0),
  };
}
