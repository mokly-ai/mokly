import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { scopeModule } from "../../dist/build/styles/modules.js";

const relative = "entries/advice.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
const message = `[mokly/build-invalid] CSS Modules cannot safely scope an escape in ${relative}:1:1; write the escape with at most five hex digits followed by exactly one space, then any spacing or comment`;

const selectors = [
  `.a\\31\t.b`,
  `.a\\31\r\n.b`,
  `.a\\31\t\t.b`,
  String.raw`.a\000031 .b`,
  String.raw`.a\000031  .b`,
  `.a\\000031\n.b`,
  `.a\\31\t/**/ .b`,
  `.a\\31\r\n/**/ .b`,
  `.a\\31\t\t/**/ .b`,
  String.raw`.a\000031 /**/ .b`,
  String.raw`.a\000031  /**/ .b`,
  `.a\\000031\n/**/ .b`,
  String.raw`.a\31/**/ .b`,
  String.raw`.a\000031/**/ .b`,
] as const;

function advisedEdit(selector: string): string {
  const match = /\\([0-9a-fA-F]{1,6})(\r\n|[ \t\n\r\f])?/u.exec(selector);
  if (!match || match.index === undefined)
    throw new Error("missing test escape");
  const shortHex = Number.parseInt(match[1]!, 16).toString(16);
  return (
    selector.slice(0, match.index) +
    `\\${shortHex} ` +
    selector.slice(match.index + match[0].length)
  );
}

test("escape advice preserves Chrome selector meaning", async ({ page }) => {
  const comparisons: {
    original: string;
    edited: string;
    delivered: string;
    kind: "rule" | "start" | "limit";
    name: string;
  }[] = [];
  for (const selector of selectors)
    for (const kind of ["rule", "start", "limit"] as const) {
      const toCss = (value: string) =>
        kind === "rule"
          ? `${value}{color:red}`
          : kind === "start"
            ? `@scope (${value}) to (.limit){.target{color:red}}`
            : `@scope (.root) to (${value}){.target{color:red}}`;
      const original = toCss(selector);
      const edited = toCss(advisedEdit(selector));
      expect(
        () => scopeModule(original, relative),
        `${kind}/${selector}`,
      ).toThrow(message);
      const delivered = scopeModule(edited, relative).css.replaceAll(
        prefix,
        "",
      );
      comparisons.push({
        original,
        edited,
        delivered,
        kind,
        name: `${kind}/${selector}`,
      });
    }
  const result = await page.evaluate(
    (rows) =>
      rows.map((row) => {
        const read = (css: string) => {
          const sheet = new CSSStyleSheet();
          try {
            sheet.replaceSync(css);
          } catch {
            return null;
          }
          const first = sheet.cssRules[0];
          if (!first) return null;
          if (row.kind === "rule")
            return (first as CSSStyleRule).selectorText ?? null;
          const scope = first as CSSScopeRule;
          return row.kind === "start" ? scope.start : scope.end;
        };
        return {
          original: read(row.original),
          edited: read(row.edited),
          delivered: read(row.delivered),
        };
      }),
    comparisons,
  );
  for (const [index, row] of comparisons.entries()) {
    expect(
      result[index]!.original,
      `${row.name}: original parses`,
    ).not.toBeNull();
    expect(result[index]!.edited, `${row.name}: edit preserves meaning`).toBe(
      result[index]!.original,
    );
    expect(
      result[index]!.delivered,
      `${row.name}: Build preserves meaning`,
    ).toBe(result[index]!.original);
  }
  test.info().annotations.push({
    type: "advice",
    description: `${comparisons.length} Chrome comparisons`,
  });
});
