import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
test("read-only MCP queries the same persisted academic records", async ({
  request,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin };
  const registration = await request.post("/api/auth/register", {
    headers,
    data: {
      email: `mcp-${Date.now()}@example.test`,
      password: "a-local-test-password-123",
    },
  });
  expect(registration.ok()).toBe(true);
  const { id: course_id } = await (
    await request.post("/api/courses", {
      headers,
      data: { name: "MCP test module" },
    })
  ).json();
  expect(
    (
      await request.post("/api/items", {
        headers,
        data: {
          title: "MCP evidenced deadline",
          course_id,
          kind: "assignment",
          starts_at: "2099-10-20T14:00:00Z",
          evidence: "A test fixture, not a university deadline.",
        },
      })
    ).ok(),
  ).toBe(true);
  const { token } = await (
    await request.post("/api/mcp-token", { headers })
  ).json();
  await request.post("/api/actions", {
    headers,
    data: { title: "MCP setup action", course_id, notes: "No known deadline" },
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      path.resolve("node_modules/tsx/dist/cli.mjs"),
      path.resolve("apps/mcp/index.ts"),
    ],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      ),
      GOBBLER_URL: "http://127.0.0.1:8787",
      GOBBLER_TOKEN: token,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "gobbler-test", version: "1.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(11);
    expect(tools.tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    const result = await client.callTool({
      name: "get_upcoming_deadlines",
      arguments: { limit: 10 },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain(
      "MCP evidenced deadline",
    );
    expect(JSON.stringify(result.structuredContent)).toContain(
      "MCP test module",
    );
    const actions = await client.callTool({
      name: "get_next_actions",
      arguments: { limit: 10 },
    });
    expect(actions.isError).not.toBe(true);
    expect(JSON.stringify(actions.structuredContent)).toContain(
      "MCP setup action",
    );
    expect(JSON.stringify(actions.structuredContent)).toContain(
      "MCP test module",
    );
    const search = await client.callTool({
      name: "search_academic_data",
      arguments: { query: "module setup", limit: 10 },
    });
    expect(search.isError).not.toBe(true);
    expect(JSON.stringify(search.structuredContent)).toContain(
      "MCP setup action",
    );
    expect((search.structuredContent as { total: number }).total).toBe(1);
  } finally {
    await client.close();
  }
});
