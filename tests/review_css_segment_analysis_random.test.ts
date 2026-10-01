import test from "node:test";

import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";

import { compareInlineOracle } from "./helpers/inline_analysis_oracle.js";
import { html, inlineInput } from "./helpers/inline_styles.js";

test("seeded flat mutations preserve M4 occurrence pairing and byte-identical materials", () => {
  const seed = 0x5e6a05;
  let state = seed;
  const pick = (length: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % length;
  };
  const pool = [
    ".a{color:red}",
    ".a {color:red}",
    ".a{color:blue}",
    ".b{color:black}",
    ".missing{}",
    ".a{--tone:red}",
    ".b{--tone:blue}",
    "@layer a;",
    "@layer a{}",
  ];
  const parser = new CssResourceAnalysis().parser;
  let previous: string[] = [];
  const styles = (rules: readonly string[]) =>
    rules.map((rule) => `<style>${rule}</style>`).join("");
  for (let index = 0; index < 1000; index++) {
    const next = [...previous];
    if (!next.length || pick(3) === 0)
      next.splice(pick(next.length + 1), 0, pool[pick(pool.length)]!);
    else if (pick(2) === 0) next.splice(pick(next.length), 1);
    else {
      const rule = next.splice(pick(next.length), 1)[0]!;
      next.splice(pick(next.length + 1), 0, rule);
    }
    if (next.length > 12) next.shift();
    compareInlineOracle(
      inlineInput({
        before: html(styles(previous), '<main class="a b"></main>'),
        after: html(styles(next), '<main class="a b"></main>'),
        parser,
      }),
      `seed=${seed}, case=${index}, before=${JSON.stringify(previous)}, after=${JSON.stringify(next)}`,
    );
    previous = next;
  }
});
