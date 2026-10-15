import { beforeEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { app } from "../apps/api/index";
import { syncFeed } from "../apps/api/sync";
import { crypt } from "../apps/api/security";

// The adapter exercises the actual migration and SQL against SQLite, without mocking query results.
let sqlite: DatabaseSync, db: D1Database;
beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0001_initial.sql", "utf8"));
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
    expect(data.changes.filter((c: any) => c.kind === "updated")).toHaveLength(
      1,
    );
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
