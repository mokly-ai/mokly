import assert from "node:assert/strict";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { SHELL_CSS } from "../src/shell/css.js";

/** One style rule: its selector list and its declarations. */
interface Rule {
  readonly selectors: readonly string[];
  readonly declarations: ReadonlyMap<string, string>;
}

const RULE = /([^{}]+)\{([^{}]*)\}/g;
const STAGE = /\.mbk-(?:component-)?stage(?![-\w])/;
const ALIGNMENT =
  /^(?:justify-content|align-items|align-content|place-content|place-items)$/;

function declarations(body: string): Map<string, string> {
  const entries: [string, string][] = [];
  for (const part of body.split(";")) {
    const colon = part.indexOf(":");
    if (colon > 0)
      entries.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
  }
  return new Map(entries);
}

/** The rules whose subject, the last compound selector, is a stage itself. */
function stageRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(RULE)]
    .map(([, selectorText = "", body = ""]) => ({
      selectors: selectorText.split(",").map((selector) => selector.trim()),
      declarations: declarations(body),
    }))
    .filter((rule) =>
      rule.selectors.some((selector) =>
        STAGE.test(selector.split(/\s*[>+~]\s*|\s+/).at(-1) ?? ""),
      ),
    );
}

test("a stage centres its frames only while they fit", () => {
  for (const css of [SHELL_CSS, embeddedStyles(SHELL_CSS, "")]) {
    const stages = stageRules(css);
    assert.ok(stages.length >= 3, "the base, stacked and component rules");
    for (const rule of stages)
      for (const [property, value] of rule.declarations)
        if (ALIGNMENT.test(property) && /\bcenter\b/.test(value))
          assert.equal(
            value,
            "safe center",
            `${rule.selectors.join(", ")} { ${property}: ${value} }`,
          );
  }
});

test("a row and a stacked frame that fit stay centred on the stage", () => {
  const stages = stageRules(SHELL_CSS);
  const row = stages.find(
    (rule) =>
      rule.selectors.includes(".mbk-stage") &&
      rule.declarations.get("display") === "flex",
  );
  const stacked = stages.find(
    (rule) => rule.declarations.get("flex-direction") === "column",
  );
  assert.equal(row?.declarations.get("justify-content"), "safe center");
  assert.equal(stacked?.declarations.get("align-items"), "safe center");
});
