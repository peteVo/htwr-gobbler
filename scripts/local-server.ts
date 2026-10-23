import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

export function localStatus(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.writeHead(405).end("{}");
    return;
  }
  try {
    const status = JSON.parse(
      fs.readFileSync(
        new URL("../.wrangler/local/status.json", import.meta.url),
        "utf8",
      ),
    );
    res.end(
      JSON.stringify({
        heartbeat: status.heartbeat,
        last_check: status.last_check,
        check_failed: status.check_failed,
        last_backup: status.last_backup,
        backup_failed: status.backup_failed,
        last_material_check: status.last_material_check ?? null,
        material_check_failed: status.material_check_failed ?? false,
      }),
    );
  } catch {
    res.end("null");
  }
}

export function createLocalServer(upstreamPort = 8787) {
  return http.createServer((req, res) => {
    // Reject DNS rebinding: only the app's loopback address is accepted.
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader("X-Gobbler-Build", "production");
    if (req.url?.split("?")[0] === "/local-status") {
      localStatus(req, res);
      return;
    }
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers: req.headers,
      },
      (response) => {
        const headers = { ...response.headers };
        if (
          headers["content-type"]?.includes("text/html") ||
          req.url?.split("?")[0] === "/sw.js"
        )
          headers["cache-control"] = "no-store";
        res.writeHead(response.statusCode ?? 502, headers);
        response.on("error", () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res
          .writeHead(502, { "Cache-Control": "no-store" })
          .end("Gobbler is starting. Please retry shortly.");
      else res.destroy();
    });
    upstream.setTimeout(120000, () => upstream.destroy());
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  createLocalServer().listen(Number(process.env.GOBBLER_PORT || 5173), "127.0.0.1");
