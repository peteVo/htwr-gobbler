import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("notification clicks open same-origin item links and reuse an existing app window", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const client = {
    url: "https://gobbler.test/",
    navigate: vi.fn(async () => {}),
    focus: vi.fn(async () => {}),
  };
  const openWindow = vi.fn(async () => {});
  const windows = [client];
  runInNewContext(readFileSync("apps/web/public/sw.js", "utf8"), {
    URL,
    self: {
      location: { origin: "https://gobbler.test" },
      addEventListener: (name: string, handler: (event: any) => void) => {
        handlers[name] = handler;
      },
      clients: { matchAll: async () => windows, openWindow },
    },
  });
  const close = vi.fn();
  let done: Promise<unknown>;
  handlers.notificationclick({
    notification: { close, data: { itemId: "item/#?" } },
    waitUntil: (promise: Promise<unknown>) => {
      done = promise;
    },
  });
  await done!;
  expect(close).toHaveBeenCalledOnce();
  expect(client.navigate).toHaveBeenCalledWith(
    "https://gobbler.test/#item/item%2F%23%3F",
  );
  expect(client.focus).toHaveBeenCalledOnce();
  expect(openWindow).not.toHaveBeenCalled();
  windows.length = 0;
  handlers.notificationclick({
    notification: { close, data: {} },
    waitUntil: (promise: Promise<unknown>) => {
      done = promise;
    },
  });
  await done!;
  expect(openWindow).toHaveBeenCalledWith("https://gobbler.test/");
});
