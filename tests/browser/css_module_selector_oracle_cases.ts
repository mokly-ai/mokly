import { combinatorOracleCases } from "./css_module_selector_oracle_combinator_cases.js";
import { shippedOracleCases } from "./css_module_selector_oracle_shipped_cases.js";

export type SelectorFamily =
  "is" | "where" | "not" | "has" | "nth-child" | "host" | "slotted";

export interface OracleCase {
  readonly name: string;
  readonly css: string;
  readonly expected?: string;
  readonly family?: SelectorFamily;
  readonly kind?: "nested" | "scope";
  readonly strict?: boolean;
}

export const oracleSeed = 0x28c55e1;
let state = oracleSeed;
function next(): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

const cases: OracleCase[] = [];
const listItems = [
  ".a,.b",
  ".a, .b",
  ".a,\n.b",
  ".a,\t.b",
  "#a, .b",
  "[data-x],.b",
  ".a > .b,.c",
  ".a.b,.c",
  ".a,.b#b",
  ".a ,.b",
  ".a/* c */,.b",
  ".a,/* c */ .b",
];

for (const family of ["is", "where", "not", "has", "nth-child"] as const)
  for (const items of listItems) {
    const argument = family === "nth-child" ? `2 of ${items}` : items;
    const selector = `.card:${family}(${argument}).active`;
    cases.push({
      name: `${family}/${JSON.stringify(items)}`,
      css: `${selector}{color:red}`,
      family,
    });
  }

const compounds = [
  ".a",
  "#a",
  "[data-x]",
  ".a.b",
  ".a#b",
  "span.a",
  ".a:hover",
  ".a[data-x]",
  "*",
  ":is(.a)",
  "div",
  ".a:not(.b)",
];
for (const item of compounds) {
  cases.push({
    name: `host/${item}`,
    family: "host",
    css: `.card:host(${item}).active{color:red}`,
  });
  cases.push({
    name: `slotted/${item}`,
    family: "slotted",
    css: `.card::slotted(${item}){color:red}`,
  });
}

for (let index = 0; index < 84; index += 1) {
  const family = (
    ["is", "where", "not", "has", "nth-child", "host", "slotted"] as const
  )[next() % 7]!;
  const prefix = next() % 2 ? ".card" : ".wrap .card";
  const item = compounds[next() % compounds.length]!;
  const argument =
    family === "host" || family === "slotted"
      ? item
      : family === "nth-child"
        ? `2 of ${listItems[next() % listItems.length]!}`
        : listItems[next() % listItems.length]!;
  const suffix = family === "slotted" ? "" : ".active";
  cases.push({
    name: `seed-${index}/${family}`,
    family,
    css: `${prefix}:${family === "slotted" ? ":" : ""}${family}(${argument})${suffix}{color:red}`,
  });
}

for (const family of ["is", "where"] as const)
  for (const trailing of [",", ", ", ",/**/", ", /* c */ "]) {
    const selector = `.card:${family}(.a${trailing}).active`;
    cases.push({
      name: `${family}/trailing/${JSON.stringify(trailing)}`,
      family,
      css: `${selector}{color:red}`,
    });
  }
cases.push({
  name: "documented trailing-comma fix",
  family: "is",
  css: ".card:is(.a ).b{color:red}",
});

for (const [source, expected] of [
  [String.raw`:global(.a\31) .b`, String.raw`.a\31  .b`],
  [String.raw`.x :global(.a\31, .b)`, String.raw`.x .a\31  .b`],
  [String.raw`.w:global(.a\31, ):hover`, String.raw`.w.a\31  :hover`],
  [String.raw`:global(#a\31) .b`, String.raw`#a\31  .b`],
  [String.raw`:local(.a\3a) .b`, String.raw`.a\3a  .b`],
  [String.raw`:global(.a\31 ).b`, String.raw`.a\31 .b`],
  [String.raw`:global(.\31 ).card`, String.raw`.\31 .card`],
  [`.w:global(.a\u00a0).b`, `.w.a\u00a0.b`],
  [String.raw`.w :global(.a\31 ,.b)`, String.raw`.w .a\31 .b`],
] as const)
  cases.push({
    name: `escape-wrapper/${source}`,
    css: `${source}{color:red}`,
    expected,
  });

for (const [source, expected] of [
  [String.raw`:global(.a\000031) .b`, String.raw`.a\000031  .b`],
  [":global(.a\\1f)\t.b", String.raw`.a\1f ` + "\t.b"],
  [String.raw`.x :global(.a\000031, .b)`, String.raw`.x .a\000031  .b`],
  [String.raw`.w:global(.a\000031, ):hover`, String.raw`.w.a\000031  :hover`],
  [String.raw`:local(.a\00006a) .b`, String.raw`.a\00006a  .b`],
  [String.raw`:global(.a\000031)  .b`, String.raw`.a\000031  .b`],
  [String.raw`:local(.a\00006A) .b`, String.raw`.a\00006A  .b`],
  [
    String.raw`.root:is(:global(.a\000031) .b)`,
    String.raw`.root:is(.a\000031  .b)`,
  ],
] as const)
  cases.push({
    name: `output-escape/${source}`,
    css: `${source}{color:red}`,
    expected,
  });
cases.push(
  {
    name: "output escape in nested rule",
    kind: "nested",
    css: String.raw`.outer{& :global(.a\000031) .b{color:red}}`,
    expected: String.raw`.outer{& .a\000031  .b{color:red}}`,
  },
  {
    name: "output escape in scope start",
    kind: "scope",
    css: String.raw`@scope (:global(.a\000031) .b) to (.limit){.x{color:red}}`,
    expected: String.raw`@scope (.a\000031  .b) to (.limit){.x{color:red}}`,
  },
  {
    name: "output escape in scope limit",
    kind: "scope",
    css: String.raw`@scope (.root) to (:global(.a\000031) .b){.x{color:red}}`,
    expected: String.raw`@scope (.root) to (.a\000031  .b){.x{color:red}}`,
  },
);

for (const source of [
  `.a\\31\t.b`,
  `.a\\31\n.b`,
  `.a\\31\r.b`,
  `.a\\31\r\n.b`,
  `.a\\31\f.b`,
  String.raw`.a\000031 .b`,
  String.raw`.a\31/**/ .b`,
  String.raw`#a\31/**/ .b`,
])
  cases.push({
    name: `escape-guard/${JSON.stringify(source)}`,
    css: `${source}{color:red}`,
  });
for (const source of [
  String.raw`.a\31 .b`,
  String.raw`.a\000031.b`,
  String.raw`.a\31 /**/ .b`,
])
  cases.push({ name: `escape-advice/${source}`, css: `${source}{color:red}` });
cases.push({
  name: "escape-comment in scope start",
  kind: "scope",
  css: String.raw`@scope (.a\31/**/ .b){.x{color:red}}`,
});
cases.push({
  name: "escape-comment in scope limit",
  kind: "scope",
  css: String.raw`@scope (.start) to (.a\31/**/ .b){.x{color:red}}`,
});

for (const [source, expected] of [
  [".w:global(.x, ,):hover", ".w.x :hover"],
  [".w:global(.x , ,):hover", ".w.x :hover"],
  [".w:local(.x,\n,):hover", ".w.x\n:hover"],
  [".w:global(.x, /* c */,):hover", ".w.x :hover"],
  [".w:global(.x,/* c */ ,):hover", ".w.x :hover"],
  [".w:global(.x, ,/* c */):hover", ".w.x :hover"],
  [".w:global(.x,, ):hover", ".w.x :hover"],
  [".w:global(.x, , ):hover", ".w.x :hover"],
  [".w:global(.x ,):hover", ".w.x:hover"],
  [".w:global(.x,/* c */,):hover", ".w.x:hover"],
  [".w:global(.x,,):hover", ".w.x:hover"],
  [".a:is(.b :global(.x, )/*c*/).c", ".a:is(.b .x/*c*/).c"],
  [".a:is(.b :global(.x, ) /*c*/).c", ".a:is(.b .x) .c"],
  [".a:is(.b :global(.x, )).c", ".a:is(.b .x) .c"],
  [".w:global(.x, )/*c*/:hover", ".w.x /*c*/:hover"],
  [".w :global(.x/* a /* b */,.y)", ".w .x/* a /* b */.y"],
  [".w :global(.x/* a */ ,.y)", ".w .x .y"],
] as const)
  cases.push({
    name: `wrapper-tail/${source}`,
    css: `${source}{color:red}`,
    expected,
  });

for (const css of [
  ".card{&:is(.a, ).active{color:red}}",
  ".card{&:where(.a,).active{color:red}}",
])
  cases.push({ name: `nested/${css}`, css, kind: "nested" });
for (const css of [
  "@scope (.card:is(.a, ).active) to (.limit){.target{color:red}}",
  "@scope (.card) to (.limit:is(.a, ).active){.target{color:red}}",
])
  cases.push({ name: `scope/${css}`, css, kind: "scope" });

cases.push(...shippedOracleCases);
cases.push(...combinatorOracleCases);

export const oracleCases: readonly OracleCase[] = cases;
