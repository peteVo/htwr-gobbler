import { localQueries } from "../apps/api/local-queries";
import { hash } from "../apps/api/security";

export async function localRequest(
  secret: string,
  route: "query" | "check",
  body: unknown,
) {
  const response = await fetch("http://127.0.0.1:8787/api/local/" + route, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(120000),
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:8787",
      "X-Gobbler-Local-Key": await hash("local-runner:" + secret),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      "Local background request failed. Start Gobbler and check its runtime log.",
    );
  return response.json();
}

export function localDatabase(secret: string): D1Database {
  return {
    prepare(sql: string) {
      const id = Object.entries(localQueries).find(
        ([, query]) => query === sql,
      )?.[0];
      if (!id) throw new Error("Unsupported local database operation");
      let values: unknown[] = [];
      const request = async (method: string) =>
        (
          (await localRequest(secret, "query", { id, values, method })) as {
            result: unknown;
          }
        ).result;
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        first() {
          return request("first");
        },
        all() {
          return request("all");
        },
        run() {
          return request("run");
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}
