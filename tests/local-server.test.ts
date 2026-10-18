import { test, expect } from "vitest";
import http, { type Server } from "node:http";
import { createLocalServer } from "../scripts/local-server";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as { port: number }).port;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
}

test("built-app gateway preserves API bodies, origins, cookies and asset bytes; rejects other hosts", async () => {
  const upstream = http.createServer(async (req, res) => {
    if (req.url === "/api/test") {
      let body = "";
      for await (const chunk of req) body += chunk;
      res.writeHead(201, {
        "Set-Cookie": ["session=synthetic; HttpOnly; SameSite=Strict"],
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          body,
          origin: req.headers.origin,
          cookie: req.headers.cookie,
          host: req.headers.host,
        }),
      );
    } else if (req.url === "/assets/test.bin") {
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(Buffer.from([0, 128, 255]));
    } else {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600",
      });
      res.end('<script src="/assets/test.js"></script>');
    }
  });
  const port = await listen(upstream),
    gateway = createLocalServer(port);
  const base = `http://127.0.0.1:${await listen(gateway)}`;
  try {
    const api = await fetch(base + "/api/test", {
      method: "POST",
      headers: { Origin: base, Cookie: "session=synthetic" },
      body: "übung",
    });
    expect(api.status).toBe(201);
    expect(api.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await api.json()).toEqual({
      body: "übung",
      origin: base,
      cookie: "session=synthetic",
      host: new URL(base).host,
    });
    const asset = await fetch(base + "/assets/test.bin");
    expect([...new Uint8Array(await asset.arrayBuffer())]).toEqual([
      0, 128, 255,
    ]);
    const html = await fetch(base);
    expect(html.headers.get("x-gobbler-build")).toBe("production");
    expect(html.headers.get("cache-control")).toBe("no-store");
    const rejected = await new Promise<number | undefined>(
      (resolve, reject) => {
        http
          .get(base, { headers: { Host: "untrusted.invalid" } }, (response) => {
            response.resume();
            resolve(response.statusCode);
          })
          .on("error", reject);
      },
    );
    expect(rejected).toBe(403);
    const status = await fetch(base + "/local-status");
    expect(status.headers.get("cache-control")).toBe("no-store");
    const data = await status.json();
    if (data)
      expect(Object.keys(data).sort()).toEqual(
        [
          "heartbeat",
          "last_check",
          "check_failed",
          "last_backup",
          "backup_failed",
          "last_material_check",
          "material_check_failed",
        ].sort(),
      );
    expect(
      (await fetch(base + "/local-status", { method: "POST" })).status,
    ).toBe(405);
    await close(upstream);
    const failed = await fetch(base + "/api/me");
    expect(failed.status).toBe(502);
    expect(failed.headers.get("cache-control")).toBe("no-store");
  } finally {
    await close(gateway);
    if (upstream.listening) await close(upstream);
  }
});
