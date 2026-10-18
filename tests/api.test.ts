import { beforeEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { app } from "../apps/api/index";
import { syncFeed, checkSources } from "../apps/api/sync";
import { crypt, hash } from "../apps/api/security";

// The adapter exercises the actual migration and SQL against SQLite, without mocking query results.
let sqlite: DatabaseSync, db: D1Database;
beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync("migrations/" + file, "utf8"));
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind: (...v: unknown[]) => {
        args = v;
        return stmt;
      },
      first: async () => sqlite.prepare(sql).get(...(args as any[])) || null,
      all: async () => ({
        results: sqlite.prepare(sql).all(...(args as any[])),
      }),
      run: async () => ({
        meta: {
          changes: Number(sqlite.prepare(sql).run(...(args as any[])).changes),
        },
      }),
    };
    return stmt;
  };
  db = {
    prepare,
    batch: async (stmts: any[]) => {
      sqlite.exec("BEGIN");
      try {
        const rows = [];
        for (const s of stmts) rows.push(await s.run());
        sqlite.exec("COMMIT");
        return rows;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
});
const env = () => ({
  DB: db,
  SESSION_SECRET: "unit-test-session-secret-at-least-32",
  FEED_SECRET: "unit-test-feed-secret-at-least-32",
  APP_ORIGIN: "http://localhost:5173",
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin = "http://localhost:5173",
  token?: string,
) {
  return app.request(
    "http://localhost:8787/api" + path,
    {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env(),
  );
}
async function account(email = "one@example.test") {
  const r = await request("/auth/register", "POST", {
    email,
    password: "a-test-password-123",
  });
  expect(r.status).toBe(200);
  return r.headers.get("set-cookie")!.split(";")[0];
}
const item = {
  title: "Proof sheet",
  kind: "assignment",
  starts_at: "2026-10-20T14:00:00.000Z",
};
describe("account-scoped API and persistence", () => {
  it("restores missing records without overwriting newer data or crossing account boundaries, and reimports idempotently", async () => {
    const a = await account(),
      b = await account("restore-other@example.test");
    const { id: course_id } = (await (
      await request("/courses", "POST", { name: "Original course" }, a)
    ).json()) as any;
    const { id } = (await (
      await request(
        "/items",
        "POST",
        { ...item, course_id, description: "Original notes", status: "done" },
        a,
      )
    ).json()) as any;
    await request(
      "/actions",
      "POST",
      { title: "Review instructions", course_id },
      a,
    );
    const exported = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    await request(
      "/items/" + id,
      "PUT",
      { ...item, title: "Newer title", course_id },
      a,
    );
    const restoredA = (await (
      await request("/restore", "POST", exported, a)
    ).json()) as any;
    expect(restoredA.added.items).toBe(0);
    expect(
      ((await (await request("/data", "GET", undefined, a)).json()) as any)
        .items[0].title,
    ).toBe("Newer title");
    const restoredB = (await (
      await request("/restore", "POST", exported, b)
    ).json()) as any;
    expect(restoredB.added).toEqual({
      courses: 1,
      items: 1,
      actions: 1,
      sources: 0,
    });
    const snapshotB = (await (
      await request("/data", "GET", undefined, b)
    ).json()) as any;
    expect(snapshotB.items[0]).toMatchObject({
      title: "Proof sheet",
      description: "Original notes",
      status: "done",
      verification: "needs_review",
      last_verified: null,
    });
    expect(snapshotB.items[0].id).not.toBe(id);
    expect(snapshotB.items[0].course_id).toBe(snapshotB.courses[0].id);
    expect(
      ((await (await request("/restore", "POST", exported, b)).json()) as any)
        .added.items,
    ).toBe(0);
    for (const invalid of [
      { ...exported, courses: [] },
      { ...exported, items: [...exported.items, ...exported.items] },
      {
        ...exported,
        items: [{ ...exported.items[0], source_url: "javascript:alert(1)" }],
      },
    ])
      expect((await request("/restore", "POST", invalid, b)).status).toBe(400);
    expect(
      ((await (await request("/data", "GET", undefined, b)).json()) as any)
        .items,
    ).toHaveLength(1);
  });
  it("restores calendar UIDs as unchecked file sources and preserves deduplication when reconnecting a feed", async () => {
    const a = await account(),
      b = await account("restore-feed@example.test");
    const text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "Calendar export", text }, a);
    const exported = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    const restored = await request("/restore", "POST", exported, b);
    expect(restored.status).toBe(200);
    const before = (await (
      await request("/data", "GET", undefined, b)
    ).json()) as any;
    expect(before.sources[0]).toMatchObject({
      kind: "file",
      status: "not_configured",
      last_success: null,
    });
    const sourceId = before.sources[0].id;
    expect(
      (
        await request(
          "/sources",
          "POST",
          {
            name: "Reconnected",
            url: "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=test",
            source_id: sourceId,
          },
          b,
        )
      ).status,
    ).toBe(200);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(text)),
    );
    try {
      expect(
        (await request("/sources/" + sourceId + "/sync", "POST", undefined, b))
          .status,
      ).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
    const after = (await (
      await request("/data", "GET", undefined, b)
    ).json()) as any;
    expect(after.items.map((i: any) => i.id).sort()).toEqual(
      before.items.map((i: any) => i.id).sort(),
    );
    expect(after.items.every((i: any) => i.verification === "confirmed")).toBe(
      true,
    );
    expect(after.sources[0].status).toBe("connected");
  });
  it("persists validated reminder preferences per account and supports older preference payloads", async () => {
    const a = await account(),
      b = await account("preferences-other@example.test");
    const prefs = {
      language: "en",
      theme: "light",
      reminders: true,
      quiet_start: 22,
      quiet_end: 7,
      reminder_hours: 6,
      deadline_changes: false,
    };
    expect((await request("/preferences", "PUT", prefs, a)).status).toBe(200);
    const read = async (cookie: string) =>
      ((await (await request("/data", "GET", undefined, cookie)).json()) as any)
        .preferences;
    expect(await read(a)).toEqual(prefs);
    expect(await read(b)).toMatchObject({
      reminders: false,
      reminder_hours: 24,
      deadline_changes: true,
    });
    for (const invalid of [
      { reminder_hours: 2 },
      { reminder_hours: "6" },
      { deadline_changes: "false" },
      { quiet_start: 25 },
    ])
      expect(
        (await request("/preferences", "PUT", { ...prefs, ...invalid }, a))
          .status,
      ).toBe(400);
    expect(await read(a)).toEqual(prefs);
    const { reminder_hours, deadline_changes, ...old } = prefs;
    expect((await request("/preferences", "PUT", old, a)).status).toBe(200);
    expect(await read(a)).toMatchObject({
      reminder_hours: 24,
      deadline_changes: true,
    });
  });
  it("keeps undated actions private, checks module ownership and preserves actions when a module is removed", async () => {
    const a = await account(),
      b = await account("action-other@example.test");
    const course = (await (
      await request("/courses", "POST", { name: "Action module" }, a)
    ).json()) as any;
    expect(
      (
        await request(
          "/actions",
          "POST",
          { title: "Foreign", course_id: course.id },
          b,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/actions",
          "POST",
          { title: "Unsafe", source_url: "javascript:alert(1)" },
          a,
        )
      ).status,
    ).toBe(400);
    const result = await request(
      "/actions",
      "POST",
      { title: "Setup MFA", course_id: course.id, notes: "No deadline stated" },
      a,
    );
    expect(result.status).toBe(201);
    const { id } = (await result.json()) as any;
    expect(
      (await request("/actions/" + id, "PUT", { title: "Changed" }, b)).status,
    ).toBe(404);
    expect(
      (await request("/actions/" + id, "DELETE", undefined, b)).status,
    ).toBe(404);
    expect(
      ((await (await request("/data", "GET", undefined, b)).json()) as any)
        .actions,
    ).toEqual([]);
    expect(
      (
        await request(
          "/actions/" + id,
          "PUT",
          { title: "Setup MFA", course_id: course.id, status: "done" },
          a,
        )
      ).status,
    ).toBe(200);
    await request("/courses/" + course.id, "DELETE", undefined, a);
    const data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(data.actions[0]).toMatchObject({
      id,
      status: "done",
      course_id: null,
    });
    expect(data.actions[0]).not.toHaveProperty("starts_at");
    expect(data.items).toHaveLength(0);
    expect(
      (await request("/actions/" + id, "DELETE", undefined, a)).status,
    ).toBe(200);
  });
  it("automatic checks skip fresh feeds and other local workspaces, then record failure without losing records", async () => {
    const a = await account();
    const user = (sqlite.prepare("SELECT id FROM users").get() as any).id;
    await account("other-monitor@example.test");
    const other = (
      sqlite.prepare("SELECT id FROM users WHERE id!=?").get(user) as any
    ).id;
    const cipher = await crypt(
      "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=synthetic",
      env().FEED_SECRET,
    );
    for (const [id, owner, attempt] of [
      ["due", user, null],
      ["fresh", user, new Date().toISOString()],
      ["other", other, null],
    ]) {
      sqlite
        .prepare(
          "INSERT INTO sources (id,user_id,name,kind,feed_cipher,last_attempt) VALUES (?,?,'Calendar','feed',?,?)",
        )
        .run(id, owner, cipher, attempt);
    }
    await request("/items", "POST", item, a);
    const fetcher = vi.fn().mockRejectedValue(new Error("private URL"));
    vi.stubGlobal("fetch", fetcher);
    try {
      expect(await checkSources(db, env().FEED_SECRET, user)).toEqual({
        attempted: 1,
        failed: 1,
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(await checkSources(db, env().FEED_SECRET, user)).toEqual({
        attempted: 0,
        failed: 0,
      });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 31 * 60000);
      expect(await checkSources(db, env().FEED_SECRET, user)).toEqual({
        attempted: 2,
        failed: 2,
      });
      expect(fetcher).toHaveBeenCalledTimes(6);
      expect(
        sqlite.prepare("SELECT status FROM sources WHERE id='due'").get()!
          .status,
      ).toBe("failed");
      expect(
        sqlite
          .prepare("SELECT last_attempt FROM sources WHERE id='other'")
          .get()!.last_attempt,
      ).toBeNull();
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM items").get()!.n).toBe(
        1,
      );
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it("reuses document candidates without resetting reviewed state, and updates a selected task for a revised document", async () => {
    const a = await account(),
      b = await account("paper-other@example.test");
    const { id: course_id }: any = await (
      await request("/courses", "POST", { name: "Paper module" }, a)
    ).json();
    const paper = {
      ...item,
      course_id,
      document_key: "a".repeat(64),
      document_hash: "b".repeat(64),
      document_name: "Sheet.pdf",
      verification: "needs_review",
    };
    const { id }: any = await (
      await request("/items", "POST", paper, a)
    ).json();
    await request(
      "/items/" + id,
      "PUT",
      {
        ...paper,
        title: "My reviewed assignment",
        status: "done",
        verification: "confirmed",
      },
      a,
    );
    expect(
      await (await request("/items", "POST", paper, a)).json(),
    ).toMatchObject({ id, reused: true });
    let data: any = await (await request("/data", "GET", undefined, a)).json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id,
      title: "My reviewed assignment",
      status: "done",
      verification: "confirmed",
    });
    const revised = {
      ...paper,
      document_key: "c".repeat(64),
      document_hash: "d".repeat(64),
      starts_at: "2026-10-19T14:00:00.000Z",
      status: "done",
    };
    expect((await request("/items/" + id, "PUT", revised, b)).status).toBe(400);
    expect((await request("/items/" + id, "POST", revised, b)).status).toBe(
      400,
    );
    await request("/items/" + id, "PUT", revised, a);
    expect(
      await (await request("/items", "POST", revised, a)).json(),
    ).toMatchObject({ id, reused: true });
    data = await (await request("/data", "GET", undefined, a)).json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id,
      document_hash: revised.document_hash,
      status: "done",
    });
    expect(data.changes[0].kind).toBe("deadline_earlier");
    expect(
      (await request("/items", "POST", { ...paper, course_id: null }, a))
        .status,
    ).toBe(400);
    // Removing modules retains documents, including the same PDF used in multiple modules.
    const { id: secondCourse }: any = await (
      await request("/courses", "POST", { name: "Second module" }, a)
    ).json();
    await request("/items", "POST", { ...revised, course_id: secondCourse }, a);
    expect(
      (await request("/courses/" + course_id, "DELETE", undefined, a)).status,
    ).toBe(200);
    expect(
      (await request("/courses/" + secondCourse, "DELETE", undefined, a))
        .status,
    ).toBe(200);
    expect(
      ((await (await request("/data", "GET", undefined, a)).json()) as any)
        .items,
    ).toHaveLength(2);
  });
  it("rotates and consumes recovery keys, resets passwords, and revokes previous sessions and MCP tokens", async () => {
    const a = await account(),
      b = await account("unaffected@example.test");
    const originalPassword = "a-test-password-123",
      nextPassword = "a-new-test-password-456";
    await request("/items", "POST", item, a);
    const { token }: any = await (
      await request("/mcp-token", "POST", undefined, a)
    ).json();
    expect(
      (await request("/recovery-key", "POST", { password: "incorrect" }, a))
        .status,
    ).toBe(401);
    const first: any = await (
      await request("/recovery-key", "POST", { password: originalPassword }, a)
    ).json();
    const second: any = await (
      await request("/recovery-key", "POST", { password: originalPassword }, a)
    ).json();
    expect(first.recovery_key).not.toBe(second.recovery_key);
    expect(
      JSON.stringify(sqlite.prepare("SELECT * FROM users").all()),
    ).not.toContain(second.recovery_key);
    expect(
      await (await request("/data", "GET", undefined, a)).text(),
    ).not.toContain("recovery_hash");
    const payload = {
      email: "one@example.test",
      password: nextPassword,
      recovery_key: second.recovery_key,
    };
    expect(
      (
        await request("/auth/recover", "POST", {
          ...payload,
          recovery_key: first.recovery_key,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/auth/recover", "POST", {
          ...payload,
          email: "unaffected@example.test",
        })
      ).status,
    ).toBe(401);
    const result = await request("/auth/recover", "POST", payload);
    expect(result.status).toBe(200);
    const recoveredCookie = result.headers.get("set-cookie")!.split(";")[0];
    expect((await request("/data", "GET", undefined, a)).status).toBe(401);
    expect(
      (await request("/data", "GET", undefined, undefined, undefined, token))
        .status,
    ).toBe(401);
    expect((await request("/data", "GET", undefined, b)).status).toBe(200);
    expect(
      (
        (await (
          await request("/data", "GET", undefined, recoveredCookie)
        ).json()) as any
      ).items,
    ).toHaveLength(1);
    expect((await request("/auth/recover", "POST", payload)).status).toBe(401);
    expect(
      (
        await request("/auth/login", "POST", {
          email: payload.email,
          password: originalPassword,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/auth/login", "POST", {
          email: payload.email,
          password: nextPassword,
        })
      ).status,
    ).toBe(200);
    expect(
      sqlite
        .prepare("SELECT recovery_hash FROM users WHERE email=?")
        .get(payload.email),
    ).toEqual({ recovery_hash: null });
  });
  it("can close pilot registration without blocking existing login or recovery and rate-limits recovery", async () => {
    const a = await account();
    const { recovery_key }: any = await (
      await request(
        "/recovery-key",
        "POST",
        { password: "a-test-password-123" },
        a,
      )
    ).json();
    const post = (action: string, payload: unknown, bindings: any) =>
      app.request(
        "http://localhost:8787/api/auth/" + action,
        {
          method: "POST",
          headers: {
            Origin: "http://localhost:5173",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        bindings,
      );
    const payload = {
      email: "one@example.test",
      password: "a-test-password-123",
      recovery_key,
    };
    const closed = { ...env(), REGISTRATION_OPEN: "false" };
    expect(
      (
        await post(
          "register",
          { email: "new@example.test", password: payload.password },
          closed,
        )
      ).status,
    ).toBe(403);
    expect((await post("login", payload, closed)).status).toBe(200);
    expect(
      (
        await post("recover", payload, {
          ...closed,
          AUTH_LIMIT: { limit: async () => ({ success: false }) },
        })
      ).status,
    ).toBe(429);
    expect((await post("recover", payload, closed)).status).toBe(200);
    expect(
      await (
        await app.request("http://localhost:8787/api/auth/options", {}, closed)
      ).json(),
    ).toEqual({ registration_open: false });
  });
  it("records old and new dates for manual assignment changes without mistaking completion for a date change", async () => {
    const a = await account();
    const { id }: any = await (await request("/items", "POST", item, a)).json();
    await request(
      "/items/" + id,
      "PUT",
      { ...item, starts_at: "2026-10-19T14:00:00.000Z" },
      a,
    );
    let data: any = await (await request("/data", "GET", undefined, a)).json();
    expect(data.changes[0]).toMatchObject({
      kind: "deadline_earlier",
      previous_starts_at: item.starts_at,
      next_starts_at: "2026-10-19T14:00:00.000Z",
      previous_all_day: 0,
      next_all_day: 0,
    });
    await request(
      "/items/" + id,
      "PUT",
      { ...item, starts_at: "2026-10-19T14:00:00.000Z", status: "done" },
      a,
    );
    data = await (await request("/data", "GET", undefined, a)).json();
    expect(data.changes[0].kind).toBe("updated");
  });
  it("enforces calendar identity across sources even if a concurrent check passed its overlap query", async () => {
    const a = await account(),
      b = await account("isolated@example.test");
    const text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "First", text }, a);
    const existing: any = sqlite.prepare("SELECT * FROM items LIMIT 1").get();
    sqlite
      .prepare(
        "INSERT INTO sources (id,user_id,name,kind) VALUES ('second',?,'Second','feed')",
      )
      .run(existing.user_id);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO items (id,user_id,source_id,external_id,title,kind,starts_at,verification) VALUES ('duplicate',?,'second',?,'Duplicate','assignment',?,'confirmed')",
        )
        .run(existing.user_id, existing.external_id, existing.starts_at),
    ).toThrow(/UNIQUE/);
    // The same university event is valid for another student.
    expect(
      (await request("/import", "POST", { name: "Another account", text }, b))
        .status,
    ).toBe(200);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM items").get()).toEqual(
      { count: 4 },
    );
  });
  it("converts a file to a feed without replacing events, modules or completion states", async () => {
    const a = await account(),
      b = await account("other@example.test");
    const text = readFileSync("tests/fixtures/moodle.ics", "utf8");
    await request("/import", "POST", { name: "Uploaded", text }, a);
    const before: any = await (
      await request("/data", "GET", undefined, a)
    ).json();
    const existing = before.items.find(
      (i: any) => i.external_id === "exercise@moodle.example.test",
    );
    await request(
      "/items/" + existing.id,
      "PUT",
      { ...existing, status: "done" },
      a,
    );
    const payload = {
      name: "Automatic Moodle",
      source_id: before.sources[0].id,
      url: "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=private",
    };
    expect((await request("/sources", "POST", payload, b)).status).toBe(409);
    expect((await request("/sources", "POST", payload, a)).status).toBe(200);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response(text))),
    );
    try {
      for (let n = 0; n < 2; n++)
        expect(
          (
            await request(
              "/sources/" + payload.source_id + "/sync",
              "POST",
              undefined,
              a,
            )
          ).status,
        ).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
    const after: any = await (
      await request("/data", "GET", undefined, a)
    ).json();
    expect(after.sources).toHaveLength(1);
    expect(after.sources[0].kind).toBe("feed");
    expect(after.items).toHaveLength(before.items.length);
    for (const old of before.items) {
      const current = after.items.find((i: any) => i.id === old.id);
      expect(current.course_id).toBe(old.course_id);
      expect(current.starts_at).toBe(old.starts_at);
    }
    expect(after.items.find((i: any) => i.id === existing.id).status).toBe(
      "done",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(
              text.replaceAll("20261103T173000Z", "20261102T173000Z"),
            ),
          ),
        ),
    );
    try {
      const result: any = await (
        await request(
          "/sources/" + payload.source_id + "/sync",
          "POST",
          undefined,
          a,
        )
      ).json();
      expect(result.changed).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
    const revised: any = await (
      await request("/data", "GET", undefined, a)
    ).json();
    expect(revised.items).toHaveLength(before.items.length);
    const revisedItem = revised.items.find((i: any) => i.id === existing.id);
    expect(revisedItem.starts_at).toBe("2026-11-02T17:30:00.000Z");
    expect(revisedItem.status).toBe("done");
    expect(revisedItem.course_id).toBe(existing.course_id);
    expect(
      (await request("/import", "POST", { name: "Again", text }, a)).status,
    ).toBe(409);
    expect((await request("/sources", "POST", payload, a)).status).toBe(409);
  });
  it("rejects a separate overlapping feed without creating duplicate events", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "Uploaded", text }, a);
    const { id }: any = await (
      await request(
        "/sources",
        "POST",
        {
          name: "Separate",
          url: "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=private",
        },
        a,
      )
    ).json();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response(text))),
    );
    try {
      expect(
        (await request("/sources/" + id + "/sync", "POST", undefined, a))
          .status,
      ).toBe(502);
    } finally {
      vi.unstubAllGlobals();
    }
    const after: any = await (
      await request("/data", "GET", undefined, a)
    ).json();
    expect(after.items).toHaveLength(2);
    expect(after.sources.find((s: any) => s.id === id).status).toBe("failed");
  });
  it("links Moodle tasks to explicit modules and preserves completion and manual course choices on reimport", async () => {
    const a = await account(),
      b = await account("another@example.test"),
      text = readFileSync("tests/fixtures/moodle.ics", "utf8");
    await request("/import", "POST", { name: "Moodle", text }, a);
    let data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(data.courses).toHaveLength(1);
    expect(data.courses[0].name).toBe("Foundations of Testing");
    expect(
      data.items.every((i: any) => i.course_id === data.courses[0].id),
    ).toBe(true);
    const original = data.items.find(
      (i: any) => i.external_id === "exercise@moodle.example.test",
    );
    const { id } = (await (
      await request("/courses", "POST", { name: "My chosen module" }, a)
    ).json()) as any;
    await request(
      "/items/" + original.id,
      "PUT",
      { ...original, status: "done", course_id: id },
      a,
    );
    await request(
      "/import",
      "POST",
      {
        name: "Moodle again",
        text: text.replace(
          "SUMMARY:Übung 1 ist fällig.",
          "SUMMARY:Übung 1 · Abgabe",
        ),
      },
      a,
    );
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.items.find((i: any) => i.id === original.id)).toMatchObject({
      status: "done",
      course_id: id,
      starts_at: "2026-11-03T17:30:00.000Z",
    });
    expect(data.courses).toHaveLength(2);
    expect(data.items).toHaveLength(4);
    expect(
      ((await (await request("/data", "GET", undefined, b)).json()) as any)
        .courses,
    ).toHaveLength(0);
  });
  it("recognizes a repeat upload without source_id even when its name changes, preserving completion", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "RWTHmoodle", text }, a);
    let data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    const original = data.items[0];
    await request(
      "/items/" + original.id,
      "PUT",
      { ...original, status: "done" },
      a,
    );
    expect(
      await (
        await request(
          "/import",
          "POST",
          { name: "University calendar", text },
          a,
        )
      ).json(),
    ).toEqual({ imported: 2, changed: 0 });
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.sources).toHaveLength(1);
    expect(data.sources[0].name).toBe("RWTHmoodle");
    expect(data.items).toHaveLength(2);
    expect(data.items.find((i: any) => i.id === original.id).status).toBe(
      "done",
    );
    expect(data.changes).toHaveLength(3);
    const b = await account("other@example.test");
    await request("/import", "POST", { name: "Same calendar", text }, b);
    expect(
      ((await (await request("/data", "GET", undefined, b)).json()) as any)
        .items,
    ).toHaveLength(2);
  });
  it("blocks partial overlaps until an existing source is explicitly selected", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "Original", text }, a);
    const overlapping = text.replace(
      "lecture@test.invalid",
      "new-lecture@test.invalid",
    );
    expect(
      (
        await request(
          "/import",
          "POST",
          { name: "New name", text: overlapping },
          a,
        )
      ).status,
    ).toBe(409);
    let data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(data.sources).toHaveLength(1);
    expect(data.items).toHaveLength(2);
    expect(
      (
        await request(
          "/import",
          "POST",
          {
            name: "Original",
            source_id: data.sources[0].id,
            text: overlapping,
          },
          a,
        )
      ).status,
    ).toBe(200);
  });
  it("serializes concurrent first imports of the same events", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    const responses = await Promise.all([
      request("/import", "POST", { name: "First", text }, a),
      request("/import", "POST", { name: "Second", text }, a),
    ]);
    expect(responses.every((r) => [200, 409].includes(r.status))).toBe(true);
    const data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(data.sources).toHaveLength(1);
    expect(data.items).toHaveLength(2);
    expect(data.changes).toHaveLength(2);
  });
  it("sets HTTPS session protections", async () => {
    const response = await app.request(
      "https://gobbler.test/api/auth/register",
      {
        method: "POST",
        headers: {
          Origin: "https://gobbler.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "secure@example.test",
          password: "a-test-password-123",
        }),
      },
      env(),
    );
    expect(response.status).toBe(200);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict"])
      expect(response.headers.get("set-cookie")).toContain(flag);
  });
  it("dismisses explicit cancellations and prevents overlapping checks", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "Test", text }, a);
    let data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    const source_id = data.sources[0].id;
    await request(
      "/import",
      "POST",
      {
        name: "Test",
        source_id,
        text: text.replace(
          "SUMMARY:Exercise sheet",
          "STATUS:CANCELLED\nSUMMARY:Exercise sheet",
        ),
      },
      a,
    );
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.items.find((i: any) => i.kind === "assignment").status).toBe(
      "dismissed",
    );
    sqlite
      .prepare("UPDATE sources SET status='syncing',last_attempt=? WHERE id=?")
      .run(new Date().toISOString(), source_id);
    expect(
      (await request("/import", "POST", { name: "Test", source_id, text }, a))
        .status,
    ).toBe(409);
  });
  it("retries a temporary feed failure then imports exactly once", async () => {
    await account();
    const user = (sqlite.prepare("SELECT id FROM users").get() as any).id;
    const cipher = await crypt(
      "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=private",
      env().FEED_SECRET,
    );
    sqlite
      .prepare(
        "INSERT INTO sources (id,user_id,name,kind,feed_cipher,status) VALUES ('feed',?,'Moodle','feed',?,'not_configured')",
      )
      .run(user, cipher);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(
        new Response(readFileSync("tests/fixtures/calendar.ics", "utf8"), {
          headers: { "Content-Type": "text/calendar" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    try {
      expect(
        await syncFeed(
          db,
          { id: "feed", user_id: user, feed_cipher: cipher },
          env().FEED_SECRET,
        ),
      ).toEqual({ imported: 2, changed: 2 });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
      fetcher.mockReset().mockResolvedValue(
        new Response("", {
          status: 302,
          headers: { Location: "https://untrusted.invalid/" },
        }),
      );
      await expect(
        syncFeed(
          db,
          { id: "feed", user_id: user, feed_cipher: cipher },
          env().FEED_SECRET,
        ),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM items").get()!.n).toBe(
        2,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("requires authentication and blocks cross-origin writes", async () => {
    expect((await request("/data")).status).toBe(401);
    expect(
      (
        await request(
          "/auth/register",
          "POST",
          { email: "a@b.test", password: "a-test-password-123" },
          undefined,
          "https://evil.test",
        )
      ).status,
    ).toBe(403);
  });
  it("sets protected cookies, persists edits, isolates users and invalidates logout", async () => {
    const a = await account(),
      b = await account("two@example.test");
    const created = (await (
      await request("/items", "POST", item, a)
    ).json()) as { id: string };
    expect(created.id).toBeTruthy();
    const stored = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(stored.items[0].title).toBe("Proof sheet");
    expect(
      (
        await request(
          "/items/" + created.id,
          "PUT",
          { ...item, status: "done" },
          b,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request("/items/" + created.id, "DELETE", undefined, b)).status,
    ).toBe(404);
    expect(
      ((await (await request("/data", "GET", undefined, b)).json()) as any)
        .items,
    ).toEqual([]);
    expect(
      (
        await request(
          "/items/" + created.id,
          "PUT",
          { ...item, status: "done" },
          a,
        )
      ).status,
    ).toBe(200);
    expect(
      ((await (await request("/data", "GET", undefined, a)).json()) as any)
        .items[0].status,
    ).toBe("done");
    await request("/logout", "POST", undefined, a);
    expect((await request("/data", "GET", undefined, a)).status).toBe(401);
  });
  it("deduplicates repeated imports, records deadline changes, and preserves data on failure", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    expect(
      (await request("/import", "POST", { name: "Test calendar", text }, a))
        .status,
    ).toBe(200);
    let data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    const source_id = data.sources[0].id;
    const repeat = await (
      await request(
        "/import",
        "POST",
        { name: "Test calendar", text, source_id },
        a,
      )
    ).json();
    expect(repeat).toEqual({ imported: 2, changed: 0 });
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.items).toHaveLength(2);
    expect(data.changes).toHaveLength(2);
    await request(
      "/import",
      "POST",
      {
        name: "Test calendar",
        text: text.replaceAll("20261020T140000Z", "20261019T140000Z"),
        source_id,
      },
      a,
    );
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.items).toHaveLength(2);
    expect(
      data.changes.filter((c: any) => c.kind === "deadline_earlier"),
    ).toHaveLength(1);
    expect(data.changes[0]).toMatchObject({
      previous_starts_at: "2026-10-20T14:00:00.000Z",
      next_starts_at: "2026-10-19T14:00:00.000Z",
    });
    expect(
      (
        await request(
          "/import",
          "POST",
          { name: "Test calendar", text: "invalid", source_id },
          a,
        )
      ).status,
    ).toBe(400);
    data = (await (await request("/data", "GET", undefined, a)).json()) as any;
    expect(data.items).toHaveLength(2);
    expect(data.sources[0].status).toBe("failed");
    expect(data.sources[0].last_success).toBeTruthy();
  });
  it("checks course ownership and validates unsafe links", async () => {
    const a = await account(),
      b = await account("b@example.test");
    const { id } = (await (
      await request("/courses", "POST", { name: "Algorithms" }, a)
    ).json()) as any;
    expect(
      (await request("/items", "POST", { ...item, course_id: id }, b)).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/items",
          "POST",
          { ...item, source_url: "javascript:alert(1)" },
          a,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request("/items", "POST", { ...item, starts_at: "bad" }, a))
        .status,
    ).toBe(400);
  });
  it("keeps MCP tokens read-only and revocable", async () => {
    const a = await account();
    const { token } = (await (
      await request("/mcp-token", "POST", undefined, a)
    ).json()) as { token: string };
    expect(
      (await request("/data", "GET", undefined, undefined, undefined, token))
        .status,
    ).toBe(200);
    expect(
      (await request("/items", "POST", item, undefined, undefined, token))
        .status,
    ).toBe(403);
    await request("/mcp-token", "DELETE", undefined, a);
    expect(
      (await request("/data", "GET", undefined, undefined, undefined, token))
        .status,
    ).toBe(401);
  });
  it("encrypts feed URLs and does not return their credentials", async () => {
    const a = await account();
    await request(
      "/sources",
      "POST",
      {
        name: "Moodle",
        url: "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=never-show-this",
      },
      a,
    );
    const result = await request("/data", "GET", undefined, a);
    expect(await result.text()).not.toContain("never-show-this");
    const row = sqlite.prepare("SELECT feed_cipher FROM sources").get() as any;
    expect(row.feed_cipher).not.toContain("never-show-this");
  });
  it("records feed failures without leaking secret URLs or dropping existing data", async () => {
    const a = await account(),
      text = readFileSync("tests/fixtures/calendar.ics", "utf8");
    await request("/import", "POST", { name: "file", text }, a);
    const user = (sqlite.prepare("SELECT id FROM users").get() as any).id;
    const cipher = await crypt(
      "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=private",
      env().FEED_SECRET,
    );
    sqlite
      .prepare(
        "INSERT INTO sources (id,user_id,name,kind,feed_cipher,status,last_success) VALUES ('feed',?,'Moodle','feed',?,'connected','2026-10-15T08:00:00Z')",
      )
      .run(user, cipher);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("secret URL private")),
    );
    await expect(
      syncFeed(
        db,
        { id: "feed", user_id: user, feed_cipher: cipher },
        env().FEED_SECRET,
      ),
    ).rejects.toThrow("outdated");
    vi.unstubAllGlobals();
    const data = (await (
      await request("/data", "GET", undefined, a)
    ).json()) as any;
    expect(data.items).toHaveLength(2);
    const source = data.sources.find((s: any) => s.id === "feed");
    expect(source.status).toBe("failed");
    expect(source.last_success).toBeTruthy();
    expect(source.error).not.toContain("private");
  });
});

it("stores module material once, isolates owners, and asks local AI only with owned excerpts", async () => {
  const one = await account(),
    two = await account("two@example.test");
  const c = (await (
    await request("/courses", "POST", { name: "Networks" }, one)
  ).json()) as { id: string };
  const material = {
    course_id: c.id,
    name: "TCP notes",
    source_url: "https://example.test/course",
    pages: [
      {
        page: 3,
        text: "TCP uses acknowledgements and retransmission to provide reliable delivery.",
      },
    ],
  };
  const created = await request("/materials", "POST", material, one);
  expect(created.status).toBe(201);
  const id = ((await created.json()) as { id: string }).id;
  expect((await request("/materials", "POST", material, two)).status).toBe(404);
  expect(
    (
      (await (await request("/materials", "POST", material, one)).json()) as {
        existing: boolean;
      }
    ).existing,
  ).toBe(true);
  expect(
    await (await request("/materials", "GET", undefined, two)).json(),
  ).toEqual([]);
  await request("/materials/" + id, "DELETE", undefined, two);
  expect(
    (
      (await (
        await request("/materials", "GET", undefined, one)
      ).json()) as unknown[]
    ).length,
  ).toBe(1);
  expect(
    (
      await request(
        "/assistant/ask",
        "POST",
        { course_id: c.id, question: "TCP?" },
        two,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        "/assistant/ask",
        "POST",
        { course_id: c.id, question: "TCP?" },
        one,
      )
    ).status,
  ).toBe(503);
  const provider = vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.redirect).toBe("manual");
    if (url.endsWith("/api/tags"))
      return Response.json({ models: [{ name: "test-local" }] });
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(String(init?.body)).messages[1].content).toContain(
      "TCP uses acknowledgements",
    );
    return Response.json({
      done: true,
      done_reason: "stop",
      message: {
        content: JSON.stringify({
          answer: "TCP retransmits data [1].",
          supported: true,
          citations: [
            { id: "1", quote: "TCP uses acknowledgements and retransmission" },
          ],
        }),
      },
    });
  });
  vi.stubGlobal("fetch", provider);
  try {
    const response = await app.request(
      "http://localhost:8787/api/assistant/ask",
      {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          Cookie: one,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: c.id,
          question: "How does TCP provide reliable delivery?",
          language: "de",
        }),
      },
      { ...env(), LOCAL_AI_MODEL: "test-local" },
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).citations[0]).toMatchObject({
      page: 3,
      name: "TCP notes",
    });
    const status = await app.request(
      "http://localhost:8787/api/assistant/status",
      { headers: { Cookie: one } },
      { ...env(), LOCAL_AI_MODEL: "test-local" },
    );
    expect(await status.json()).toEqual({ ready: true, model: "test-local" });
    expect(provider).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
  await request("/courses/" + c.id, "DELETE", undefined, one);
  expect(
    await (await request("/materials", "GET", undefined, one)).json(),
  ).toEqual([]);
});

it("permits fixed local-runner queries only on loopback with the derived operator key", async () => {
  await account();
  const user = sqlite.prepare("SELECT id FROM users").get()!.id;
  const body = { id: "user", values: [user], method: "first" };
  const key = await hash("local-runner:" + env().SESSION_SECRET);
  const query = (host: string, credential: string, value: unknown = body) =>
    app.request(
      "http://" + host + "/api/local/query",
      {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
          "X-Gobbler-Local-Key": credential,
        },
        body: JSON.stringify(value),
      },
      env(),
    );
  expect((await query("127.0.0.1:8787", "")).status).toBe(403);
  expect((await query("127.0.0.1:8787", "wrong")).status).toBe(403);
  expect((await query("example.test", key)).status).toBe(403);
  expect((await query("127.0.0.1:8787", key, { ...body, id: -1 })).status).toBe(
    400,
  );
  expect(
    (await query("127.0.0.1:8787", key, { ...body, method: "exec" })).status,
  ).toBe(400);
  expect(await (await query("127.0.0.1:8787", key)).json()).toEqual({
    result: { id: user },
  });
});

it("keeps automatic material candidates private, omits reviewed dates and excludes unavailable PDFs from AI", async () => {
  const one = await account(),
    two = await account("folder-other@example.test");
  const { id: course } = (await (
    await request("/courses", "POST", { name: "Networks" }, one)
  ).json()) as any;
  const user = sqlite
    .prepare("SELECT user_id FROM courses WHERE id=?")
    .get(course)!.user_id;
  const candidate = {
    course_id: course,
    document_key: "b".repeat(64),
    document_hash: "a".repeat(64),
    document_name: "Sheet.pdf",
    source_url: "",
    title: "Date",
    deadline: "2026-10-22T12:00:00.000Z",
    document: "Sheet.pdf",
    evidence: "Abgabe 22.10.2026",
    page: 1,
  };
  sqlite
    .prepare(
      "INSERT INTO sources (id,user_id,name,kind) VALUES ('folder',?,'Local files','folder')",
    )
    .run(user);
  sqlite
    .prepare(
      "INSERT INTO materials (id,user_id,course_id,name,pages,content_hash,created_at,managed,candidates) VALUES ('m',?,?,'Sheet.pdf',?,'hash','now',1,?)",
    )
    .run(
      user,
      course,
      JSON.stringify([{ page: 1, text: "Private course text" }]),
      JSON.stringify([candidate]),
    );
  sqlite
    .prepare(
      "INSERT INTO material_files (user_id,source_id,relative_path,material_id,state) VALUES (?,'folder','Sheet.pdf','m','available')",
    )
    .run(user);
  expect(
    await (
      await request("/materials/candidates", "GET", undefined, two)
    ).json(),
  ).toEqual([]);
  expect(
    await (
      await request("/materials/candidates", "GET", undefined, one)
    ).json(),
  ).toEqual([candidate]);
  expect((await request("/materials/m", "DELETE", undefined, one)).status).toBe(
    409,
  );
  await request(
    "/items",
    "POST",
    {
      ...item,
      course_id: course,
      document_name: candidate.document_name,
      document_hash: candidate.document_hash,
      document_key: candidate.document_key,
    },
    one,
  );
  expect(
    await (
      await request("/materials/candidates", "GET", undefined, one)
    ).json(),
  ).toEqual([]);
  sqlite.exec("UPDATE material_files SET state='unreadable'");
  expect(
    await (await request("/materials/issues", "GET", undefined, two)).json(),
  ).toEqual([]);
  expect(
    await (await request("/materials/issues", "GET", undefined, one)).json(),
  ).toEqual([
    {
      source_name: "Local files",
      relative_path: "Sheet.pdf",
      state: "unreadable",
    },
  ]);
  const provider = vi.fn();
  vi.stubGlobal("fetch", provider);
  try {
    expect(
      await (
        await request(
          "/assistant/ask",
          "POST",
          { course_id: course, question: "What does it say?" },
          one,
        )
      ).json(),
    ).toEqual({ answer: "", supported: false, citations: [] });
    expect(provider).not.toHaveBeenCalled();
    expect(
      (
        (await (
          await request("/materials", "GET", undefined, one)
        ).json()) as any[]
      )[0].available,
    ).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
