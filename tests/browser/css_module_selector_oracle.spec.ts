import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { expect, test } from "@playwright/test";

import { scopeModule } from "../../dist/build/styles/modules.js";
import { pluginModuleOutput } from "../helpers/css_module_plugin_output.js";

interface Case {
  readonly name: string;
  readonly css: string;
  readonly expected?: string;
  readonly reject?: boolean;
  readonly kind?: "nested" | "scope";
}

const seed = 0x26c55e1;
let state = seed;
function next(): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

const pseudos = [
  ":is",
  ":where",
  ":not",
  ":has",
  ":nth-child(2 of ",
  ":host",
  "::slotted",
] as const;
const cases: Case[] = [];

for (const pseudo of pseudos) {
  for (const separator of [
    ",",
    ", ",
    ",\n",
    ",\t",
    " ,",
    ",/**/",
    ", /* c */ ",
  ]) {
    const opening = pseudo.includes("(") ? pseudo : `${pseudo}(`;
    const selector = `.card${opening}.a${separator}.b).active`;
    cases.push({
      name: `${pseudo}/${JSON.stringify(separator)}`,
      css: `${selector}{color:red}`,
    });
  }
  for (const trailing of [",", ", ", ",/**/", ", /* c */ "]) {
    const opening = pseudo.includes("(") ? pseudo : `${pseudo}(`;
    const selector = `.card${opening}.a${trailing}).active`;
    cases.push({
      name: `${pseudo}/trailing/${JSON.stringify(trailing)}`,
      css: `${selector}{color:red}`,
    });
  }
}

for (let index = 0; index < 160; index += 1) {
  const pseudo = pseudos[next() % pseudos.length]!;
  const opening = pseudo.includes("(") ? pseudo : `${pseudo}(`;
  const item = [".a", "#a", "[data-x]", "div.a", ".a > .b"][next() % 5]!;
  const separator = [",", ", ", " ,", ",\n", ",/**/", ", /* c */ "][
    next() % 6
  ]!;
  const trailing = next() % 3 === 0 ? [",", ", ", ",/**/"][next() % 3]! : "";
  const selector = `.card${opening}${item}${separator}.b${trailing}).active`;
  cases.push({ name: `seed-${index}`, css: `${selector}{color:red}` });
}

for (const css of [
  ".card{&:is(.a, ).active{color:red}}",
  ".card{&:where(.a,).active{color:red}}",
  ".card{&:not(.a, ).active{color:red}}",
])
  cases.push({ name: `nested/${css}`, css, kind: "nested" });

for (const css of [
  "@scope (.card:is(.a, ).active) to (.limit){.target{color:red}}",
  "@scope (.card) to (.limit:is(.a, ).active){.target{color:red}}",
  "@scope (.card:is(.a,).active) to (.limit){.target{color:red}}",
])
  cases.push({ name: `scope/${css}`, css, kind: "scope" });

for (const mode of ["global", "local"] as const)
  for (const separator of ["", " ", "\n", "\t", " ,", "/**/", " /* c */ "]) {
    const spaced = /\s/u.test(separator);
    const source = `.wrap :${mode}(.x,${separator}.y)`;
    const expected = `.wrap .x${spaced ? " " : ""}.y`;
    cases.push({
      name: `${mode}/${JSON.stringify(separator)}`,
      css: `${source}{color:red}`,
      expected,
    });
  }

for (const [source, expected, reject] of [
  [".w:global(.x, ):hover", ".w.x :hover", false],
  [".w:local(.x, ):hover", ".w.x :hover", false],
  [".w:global(.a, ):global(.x)", ".w.a .x", false],
  [".a:is(.b, :global(.x, )).c", ".a:is(.b, .x) .c", false],
  [".w :global(.x, , .y)", ".w .x .y", false],
  [".w :global(.a,:is(.b, ),.c)", "", true],
  [".w:global()", "", true],
  [".w:local( )", "", true],
  [".w:global(,)", "", true],
  [".w:global(/* c */)", "", true],
  ["[a]:global(,)div", "", true],
  [".w :global(div,span)", "", true],
  [".w:global(div)", "", true],
] as const)
  cases.push({
    name: `fixed/${source}`,
    css: `${source}{color:red}`,
    expected,
    reject,
  });

for (const [source, expected] of [
  [".card:is(:global(.x,.y)).active", ".card:is(.x.y).active"],
  [".card:where(:local(.x, .y)).active", ".card:where(.x .y).active"],
  [".card:not(:global(.x,.y)).active", ".card:not(.x.y).active"],
  [".card:has(:local(.x, .y)).active", ".card:has(.x .y).active"],
  [".card:nth-child(2 of :global(.x,.y))", ".card:nth-child(2 of .x.y)"],
  [".card:host(:global(.x,.y))", ".card:host(.x.y)"],
  [".card::slotted(:local(.x,.y))", ".card::slotted(.x.y)"],
] as const)
  cases.push({
    name: `nested-wrapper/${source}`,
    css: `${source}{color:red}`,
    expected,
  });

cases.push(
  {
    name: "wrapper in nested rule",
    css: ".card{& :global(.x,.y){color:red}}",
    expected: ".card{& .x.y{color:red}}",
    kind: "nested",
  },
  {
    name: "wrapper in both scope groups",
    css: "@scope (:global(.x,.y)) to (:local(.a, .b)){.target{color:red}}",
    expected: "@scope (.x.y) to (.a .b){.target{color:red}}",
    kind: "scope",
  },
  {
    name: "all-empty wrapper in scope start",
    css: "@scope (:global(,)) to (.limit){.target{color:red}}",
    reject: true,
  },
  {
    name: "all-empty wrapper in scope limit",
    css: "@scope (.start) to (:local(/* c */)){.target{color:red}}",
    reject: true,
  },
);

test(`seeded Chrome selector oracle (seed ${seed})`, async ({ page }) => {
  const started = performance.now();
  const relative = "entries/oracle.module.css";
  const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
  const comparisons: {
    name: string;
    authored: string;
    delivered: string;
    kind?: Case["kind"];
    accepted: boolean;
    reject: boolean;
  }[] = [];
  for (const candidate of cases) {
    let delivered = "";
    try {
      if (!candidate.reject)
        delivered = pluginModuleOutput(
          candidate.css,
          relative,
          prefix,
        ).css.replaceAll(prefix, "");
    } catch (error) {
      throw new Error(`plugin rejected ${candidate.name}: ${candidate.css}`, {
        cause: error,
      });
    }
    let accepted = true;
    try {
      scopeModule(candidate.css, relative);
    } catch {
      accepted = false;
    }
    comparisons.push({
      name: candidate.name,
      authored:
        candidate.expected === undefined
          ? candidate.css
          : candidate.kind
            ? candidate.expected
            : `${candidate.expected}{color:red}`,
      delivered,
      accepted,
      reject: candidate.reject ?? false,
      ...(candidate.kind ? { kind: candidate.kind } : {}),
    });
  }
  const results: {
    okay: boolean;
    authored: string | null;
    delivered: string | null;
    accepted: boolean;
    unparseable?: boolean;
  }[] = [];
  for (let index = 0; index < comparisons.length; index += 80) {
    const batch = comparisons.slice(index, index + 80);
    results.push(
      ...(await page.evaluate((items) => {
        const parsed = (css: string, kind?: "nested" | "scope") => {
          const sheet = new CSSStyleSheet();
          try {
            sheet.replaceSync(css);
          } catch {
            return null;
          }
          const first = sheet.cssRules[0];
          if (!first) return null;
          if (kind === "nested") {
            const nested = (first as CSSStyleRule).cssRules?.[0] as
              CSSStyleRule | undefined;
            return nested?.selectorText ?? null;
          }
          if (kind === "scope") {
            const scope = first as CSSScopeRule;
            return `${scope.start}|${scope.end}`;
          }
          return (first as CSSStyleRule).selectorText ?? null;
        };
        return items.map((item) => {
          if (item.reject)
            return {
              okay: !item.accepted,
              authored: null,
              delivered: null,
              accepted: item.accepted,
            };
          const authored = parsed(item.authored, item.kind);
          const delivered = parsed(item.delivered, item.kind);
          // Chrome drops both unparseable selectors, so neither has a selector text to compare.
          if (authored === null && delivered === null)
            return {
              okay: true,
              authored,
              delivered,
              accepted: item.accepted,
              unparseable: true,
            };
          return {
            okay: (authored === delivered) === item.accepted,
            authored,
            delivered,
            accepted: item.accepted,
          };
        });
      }, batch)),
    );
  }
  for (let index = 0; index < cases.length; index += 1)
    expect(
      results[index]!.okay,
      `${cases[index]!.name}: ${JSON.stringify(results[index])}`,
    ).toBe(true);
  test.info().annotations.push({
    type: "oracle",
    description: `${cases.length} cases, ${results.filter((result) => result.unparseable).length} both-unparseable exceptions, ${(performance.now() - started).toFixed(1)} ms`,
  });
});
