import type { OracleCase } from "./css_module_selector_oracle_cases.js";

const wrapped = [
  [
    String.raw`:global(.icon-\2192/* arrow */)` + "\n.label",
    String.raw`.icon-\2192/* arrow */` + "\n.label",
  ],
  [String.raw`:global(.a\31/**/)` + "\t.b", String.raw`.a\31/**/` + "\t.b"],
  [String.raw`:global(.a\000031/**/) .b`, String.raw`.a\000031/**/ .b`],
  [String.raw`:local(.a\2192/**/)` + "\n.b", String.raw`.a\2192/**/` + "\n.b"],
  [String.raw`.x :global(.a\31/**/, .b)`, String.raw`.x .a\31/**/ .b`],
  [String.raw`.x :global(.a\31/**/,.b)`, String.raw`.x .a\31/**/.b`],
] as const;

export const shippedOracleCases: readonly OracleCase[] = [
  ...wrapped.map(([source, expected]) => ({
    name: `shipped-comment/${source}`,
    css: `${source}{color:red}`,
    expected,
  })),
  {
    name: "shipped adjacent comments",
    css: String.raw`.a\31/**//**/` + "\n.b{color:red}",
  },
  {
    name: "shipped nested selector",
    kind: "nested",
    css: String.raw`.outer{:global(.a\31/**/)` + "\t.b{color:red}}",
    expected: String.raw`.outer{.a\31/**/` + "\t.b{color:red}}",
  },
  {
    name: "shipped scope start",
    kind: "scope",
    css:
      String.raw`@scope (:global(.a\31/**/)` +
      "\t.b) to (.limit){.target{color:red}}",
    expected:
      String.raw`@scope (.a\31/**/` + "\t.b) to (.limit){.target{color:red}}",
  },
  {
    name: "shipped scope limit",
    kind: "scope",
    css:
      String.raw`@scope (.root) to (:global(.a\31/**/)` +
      "\t.b){.target{color:red}}",
    expected:
      String.raw`@scope (.root) to (.a\31/**/` + "\t.b){.target{color:red}}",
  },
  {
    name: "unchanged outside scope comment",
    kind: "scope",
    css: "@scope ([data-a]) /* c */ to ([data-b]){.target{color:red}}",
  },
  {
    name: "unchanged inside scope comment",
    kind: "scope",
    css: "@scope ([data-a] /* c */ div) to ([data-b]){.target{color:red}}",
  },
  {
    name: "unchanged kept scope comments",
    kind: "scope",
    css: "@scope ([data-a])/**/to/**/([data-b]){.target{color:red}}",
  },
  {
    name: "changed outside scope comment",
    kind: "scope",
    css: "@scope (.a) /* c */ to (.b){.target{color:red}}",
  },
  { name: "unchanged rule comment", css: "[data-x] /* c */ div{color:red}" },
  {
    name: "byte-identical escaped comma",
    css: String.raw`::part(a\,/**/b){color:red}`,
  },
  {
    name: "byte-identical escaped space",
    css: String.raw`::part(a\ /**/b){color:red}`,
  },
];
