import assert from "node:assert/strict";
import test from "node:test";

import { scanCssSegments } from "../src/review/css/segments.js";

import { segmentOracle } from "./helpers/css_segments.js";

const seed = 0x5ca1ab1e;
const pool = [
  ".a{color:red}",
  ".a{color:blue}",
  ".b{}",
  "@layer a;",
  "@layer a{}",
  "@media screen{.a{color:red}.b{display:block}}",
  "@supports (display:grid){@layer a{.a{display:grid}}}",
  ".a{color:red;&:hover{color:blue}background:black}",
  "@container (width>1px){.b{color:red}}",
  "@font-face{font-family:A;src:url(font.woff)}",
  "@keyframes spin{0%{opacity:0}100%{opacity:1}}",
  "@unknown foo{a:b}",
  String.raw`.a{content:'{\'}';--x:"}\"{"}`,
  String.raw`.\7b a{--x:\};background:u\72l(a{b})}`,
  String.raw`.a{background:url(a{[/*x*/\)z)}`,
  ".a/**/{color:/**/red}",
  '@import "theme.css";',
  '@charset "UTF-8";',
  '@namespace svg "urn:svg";',
  "svg|a{fill:red}",
  ".a{content:'broken}",
  ".a{color:red]}",
  ".a{background:url(unclosed}",
  ".a{--tone:red;padding:2px}",
];
const trivia = [
  "",
  "\n",
  "\r\n",
  "\f",
  "/*{'}*/",
  "<!-- -->",
  "<!--a{}",
  "-->",
  "\uFEFF",
  " ",
];

test(`1000 seeded insert/delete/reorder and lexical mutations equal whole parsing (seed ${seed})`, () => {
  let state = seed;
  const pick = (limit: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
  const compare = segmentOracle();
  let current = [pool[0]!, pool[1]!, pool[5]!];
  const operations = new Set<number>();
  const selectedRules = new Set<number>();
  const selectedTrivia = new Set<number>();
  let parsed = 0;
  let anomalies = 0;
  for (let index = 0; index < 1000; index++) {
    const next = [...current];
    const operation = pick(3);
    operations.add(operation);
    if (operation === 0 || !next.length) {
      const selected = pick(pool.length);
      selectedRules.add(selected);
      next.splice(pick(next.length + 1), 0, pool[selected]!);
    } else if (operation === 1) next.splice(pick(next.length), 1);
    else {
      const removed = next.splice(pick(next.length), 1)[0]!;
      next.splice(pick(next.length + 1), 0, removed);
    }
    if (next.length > 12) next.shift();
    const decorate = (rules: readonly string[]) => {
      const gap = pick(trivia.length);
      selectedTrivia.add(gap);
      const body = rules.join(trivia[gap]!);
      return `${trivia[pick(trivia.length)]}${body}${trivia[pick(trivia.length)]}`;
    };
    for (const [side, source] of [
      ["before", decorate(current)],
      ["after", decorate(next)],
    ]) {
      const result = compare(
        source!,
        `seed=${seed}, case=${index}, side=${side}, source=${JSON.stringify(source)}`,
      );
      if (result.status === "parsed") parsed++;
      if (scanCssSegments(source!).status === "anomaly") anomalies++;
    }
    current = next;
  }
  assert.equal(operations.size, 3);
  assert.equal(selectedRules.size, pool.length);
  assert.equal(selectedTrivia.size, trivia.length);
  assert.ok(parsed > 200);
  assert.ok(anomalies > 200);
});
