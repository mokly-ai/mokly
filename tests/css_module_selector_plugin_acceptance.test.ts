import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { verifyModuleScoping } from "../dist/build/styles/module_verify.js";
import { scopeModule } from "../dist/build/styles/modules.js";

import { pluginModuleOutput } from "./helpers/css_module_plugin_output.js";
import { startDuration } from "./helpers/durations.js";

const relative = "entries/matrix.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
const modes = ["global", "local"] as const;
const separators = [
  "",
  " ",
  "\n",
  "\t",
  "before",
  "/**/",
  " /* c */ ",
] as const;
const shapes = [
  {
    name: "classes",
    first: ".x",
    second: ".y",
    nextType: false,
    firstType: false,
  },
  {
    name: "ids",
    first: "#hero",
    second: "#footer",
    nextType: false,
    firstType: false,
  },
  {
    name: "attributes",
    first: "[data-x]",
    second: "[data-y]",
    nextType: false,
    firstType: false,
  },
  {
    name: "pseudos",
    first: ":hover",
    second: ":focus",
    nextType: false,
    firstType: false,
  },
  {
    name: "compounds",
    first: ".x#hero",
    second: ".y#footer",
    nextType: false,
    firstType: false,
  },
  {
    name: "combinator item",
    first: ".x > .a",
    second: ".y",
    nextType: false,
    firstType: false,
  },
  {
    name: "types",
    first: "div",
    second: "span",
    nextType: true,
    firstType: true,
  },
  {
    name: "type compounds",
    first: "div.x",
    second: "span.y",
    nextType: true,
    firstType: true,
  },
] as const;

interface Context {
  readonly name: string;
  readonly before: string;
  readonly after: string;
  readonly firstAttached?: boolean;
  readonly finalType?: boolean;
}

const contexts: readonly Context[] = [
  { name: "start", before: "", after: " .tail" },
  { name: "middle", before: ".wrap ", after: " .tail" },
  { name: "end", before: ".wrap ", after: "" },
  { name: "attached before", before: ".wrap", after: "", firstAttached: true },
  { name: "attached after", before: "", after: ".tail" },
  {
    name: "attached both",
    before: ".wrap",
    after: ".tail",
    firstAttached: true,
  },
  { name: "type suffix", before: ".wrap ", after: "div", finalType: true },
  { name: "is", before: ".wrap :is(", after: ")" },
  { name: "not", before: ".wrap :not(", after: ")" },
  { name: "where", before: ".wrap :where(", after: ")" },
  { name: "has", before: ".wrap :has(", after: ")" },
  { name: "nesting", before: ".wrap{& ", after: "{color:red}}" },
  {
    name: "scope start",
    before: "@scope (.wrap ",
    after: "){.target{color:red}}",
  },
  {
    name: "scope limit",
    before: "@scope (.wrap) to (",
    after: "){.target{color:red}}",
  },
  { name: "media", before: "@media screen{.wrap ", after: "{color:red}}" },
  { name: "multi-selector", before: ".wrap ", after: ", .tail{color:red}" },
];

function source(context: Context, wrapper: string): string {
  const combined = `${context.before}${wrapper}${context.after}`;
  return combined.includes("{color:red") ? combined : `${combined}{color:red}`;
}

function separatorText(separator: (typeof separators)[number]): string {
  return separator === "before" ? " ," : `,${separator}`;
}

function mustReject(
  context: Context,
  shape: (typeof shapes)[number],
  separator: string,
): boolean {
  const compoundJoin = separator === "" || separator === "/**/";
  return Boolean(
    (compoundJoin && shape.nextType) ||
    (context.firstAttached && shape.firstType) ||
    context.finalType,
  );
}

test(
  "generated plugin-output matrix has no false rejections",
  { timeout: 20_000 },
  (context) => {
    const duration = startDuration();
    let accepted = 0;
    let rejected = 0;
    for (const mode of modes)
      for (const shape of shapes)
        for (const separator of separators)
          for (const candidate of contexts) {
            const css = source(
              candidate,
              `:${mode}(${shape.first}${separatorText(separator)}${shape.second})`,
            );
            const label = `${mode}/${shape.name}/${JSON.stringify(separator)}/${candidate.name}`;
            let plugin;
            try {
              plugin = pluginModuleOutput(css, relative, prefix);
            } catch (error) {
              throw new Error(`plugin rejected ${label}: ${String(error)}`, {
                cause: error,
              });
            }
            if (mustReject(candidate, shape, separator)) {
              assert.throws(
                () => scopeModule(css, relative),
                /CSS Modules scoping would change more than local names/,
                label,
              );
              rejected += 1;
            } else {
              assert.doesNotThrow(
                () => verifyModuleScoping(css, plugin.css, relative, prefix),
                label,
              );
              assert.doesNotThrow(() => scopeModule(css, relative), label);
              accepted += 1;
            }
          }
    context.diagnostic(
      `${accepted + rejected} generated selector cases: ${accepted} accepted, ${rejected} rejected, ${duration()}`,
    );
  },
);

test("nonempty plugin selector-list items are not falsely rejected", () => {
  let cases = 0;
  for (const mode of modes)
    for (const candidate of contexts)
      for (const items of [
        ", .x",
        ".x,,.y",
        ".x, .y,",
        ".x, , .y",
        ".x, /* c */, .y",
        ",",
        "/* c */, /* d */",
      ]) {
        const css = source(candidate, `:${mode}(${items})`);
        const hasSelector = /\.[xy]\b/u.test(items);
        if (!hasSelector) {
          assert.throws(
            () => scopeModule(css, relative),
            /CSS Modules :(?:global|local)\(\) has no selector/,
          );
          cases += 1;
          continue;
        }
        const plugin = pluginModuleOutput(css, relative, prefix);
        const invalid = Boolean(candidate.finalType);
        if (invalid) {
          assert.throws(
            () => scopeModule(css, relative),
            /CSS Modules scoping would change more than local names/,
            `${candidate.name}/${mode}/${items}`,
          );
          cases += 1;
          continue;
        }
        assert.doesNotThrow(
          () => verifyModuleScoping(css, plugin.css, relative, prefix),
          `${candidate.name}/${mode}/${items}`,
        );
        assert.doesNotThrow(() => scopeModule(css, relative));
        cases += 1;
      }
  assert.equal(cases, contexts.length * modes.length * 7);
});
