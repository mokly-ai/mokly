import type { OracleCase } from "./css_module_selector_oracle_cases.js";

const selectors = [
  "ul > /* direct */ li",
  "ul >/* c */ li",
  "[x]>/**/ [x]",
  "ul\n  > /* c */\n  li",
  "div + /* c */ p",
  "div ~ /* c */ p",
  "div + /* c */\tp",
  "div ~/**/\np",
  "div > /* a */ /* b */ p",
  "div /* a */ > /* b */ p",
  "li:nth-child(2n + /* c */ 1)",
  "li:nth-child(2n+/* c */ 1)",
  ":has(> /* c */ p)",
  "ul > /* c */ li, ol > li",
  "ul > /* c */li",
  "ul /* c */ > li",
  "div /* c */ p",
  ".a > /* c */ .b",
  ":has(/* c */ > p)",
] as const;

export const combinatorOracleCases: readonly OracleCase[] = [
  ...selectors.map((selector) => ({
    name: `comment-combinator/${selector}`,
    css: `${selector}{color:red}`,
  })),
  {
    name: "comment-combinator/nested",
    kind: "nested",
    css: ".p { & > /* c */ li { color:red } }",
  },
  {
    name: "comment-combinator/scope",
    kind: "scope",
    css: "@scope ([data-a] > /* c */ div) { .target {color:red} }",
  },
];
