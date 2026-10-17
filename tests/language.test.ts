import { expect, it } from "vitest";
import fs from "node:fs";
import ts from "typescript";
import catalogue from "../apps/web/src/locales.json";
import { translate } from "../apps/web/src/text";

it("keeps German and Vietnamese catalogue placeholders complete and preserves substituted source text", () => {
  for (const [english, translations] of Object.entries(catalogue)) {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
    for (const language of ["de", "vi"] as const) {
      expect(translations[language].trim(), english).not.toBe("");
      expect(placeholders(translations[language]), english).toEqual(
        placeholders(english),
      );
    }
  }
  expect(
    translate("de", "Open original source for {0}", "Save {1} <b>Title</b>"),
  ).toBe("Originalquelle für Save {1} <b>Title</b> öffnen");
  expect(translate("vi", "Unrecognized diagnostic")).toBe(
    "Unrecognized diagnostic",
  );
  expect(translate("en", "Title")).toBe("Title");
});

it("routes visible app text through the catalogue and checks literal translation keys", () => {
  const unlocalized: string[] = [];
  const missing: string[] = [];
  const originals = new Set([
    "htwr",
    "gobbler",
    "rwth",
    "RWTH Aachen",
    "Europe / Berlin",
    "g.",
    "English",
    "Deutsch",
    "Tiếng Việt",
    "htwr–gobbler",
    "Europe/Berlin",
  ]);
  for (const name of [
    "main.tsx",
    "Actions.tsx",
    "SearchResults.tsx",
    "ReminderSettings.tsx",
    "Restore.tsx",
    "Assistant.tsx",
  ]) {
    const file = ts.createSourceFile(
      name,
      fs.readFileSync("apps/web/src/" + name, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const key = (node: ts.Node) => {
      if (ts.isStringLiteral(node) && !(node.text in catalogue))
        missing.push(node.text);
      if (ts.isConditionalExpression(node)) {
        key(node.whenTrue);
        key(node.whenFalse);
      }
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (/[A-Za-z]/.test(text) && !originals.has(text))
          unlocalized.push(name + ": " + text);
      }
      if (ts.isCallExpression(node) && node.expression.getText(file) === "tx")
        key(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  expect(unlocalized).toEqual([]);
  expect(missing).toEqual([]);
});
