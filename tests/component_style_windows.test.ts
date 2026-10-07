import assert from "node:assert/strict";
import test from "node:test";

import { changedStyleWindows } from "../dist/review/style_windows.js";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

test("windows use UTF-16 code units and never overlap the longest prefix", () => {
  assert.deepEqual(changedStyleWindows("aaa", "aaaa"), {
    before: { start: 3, end: 3 },
    after: { start: 3, end: 4 },
  });
  assert.deepEqual(changedStyleWindows("x😀a😀z", "x😁b😀z"), {
    before: { start: 2, end: 4 },
    after: { start: 2, end: 4 },
  });
  assert.deepEqual(changedStyleWindows("abcabc", "abc"), {
    before: { start: 3, end: 6 },
    after: { start: 3, end: 3 },
  });
  assert.equal(changedStyleWindows("same", "same"), undefined);
});

test("single-window boundary proofs", async (context) => {
  const fixture = await styleRouteFixture(context);
  const cases = [
    [
      "insertion at closing tag",
      ".entry{color:red}",
      ".entry{color:red}.missing{color:blue}",
      "style",
    ],
    [
      "deletion at closing tag",
      ".entry{color:red}.missing{color:blue}",
      ".entry{color:red}",
      "style",
    ],
    ["format only", ".entry{color:red}", ".entry { color: red; }", "style"],
    [
      "literal pseudo word",
      '.missing{content:":parent :empty";color:red}',
      '.missing{content:":parent :empty";color:blue}',
      "style",
    ],
    [
      "less-than exactly nine before",
      '.missing{content:"<12345678red"}',
      '.missing{content:"<12345678blue"}',
      "style",
    ],
    [
      "less-than exactly eight before",
      '.missing{content:"<1234567red"}',
      '.missing{content:"<1234567blue"}',
      "complete",
    ],
    [
      "less-than inside",
      '.missing{content:"red"}',
      '.missing{content:"<blue"}',
      "complete",
    ],
    [
      "empty insertion within eight",
      '.missing{content:"<1234567"}',
      '.missing{content:"<1234567x"}',
      "complete",
    ],
    [
      "empty deletion within eight",
      '.missing{content:"<1234567x"}',
      '.missing{content:"<1234567"}',
      "complete",
    ],
    [
      "empty insertion nine before",
      '.missing{content:"<12345678"}',
      '.missing{content:"<12345678x"}',
      "style",
    ],
    [
      "empty deletion nine before",
      '.missing{content:"<12345678x"}',
      '.missing{content:"<12345678"}',
      "style",
    ],
    [
      "raw end tag transition",
      '/* padding */.entry{content:"</sty"}',
      '/* padding */.entry{content:"</style>"}',
      "complete",
    ],
    [
      "edited parse failure",
      ".entry{color:red}",
      ".entry{color:blue",
      "complete",
    ],
  ] as const;
  for (const [name, before, after, route] of cases)
    await context.test(name, async () => {
      await assertStyleRoute(
        withHeadStyles(
          fixture,
          `<style>${before}</style>`,
          `<style>${after}</style>`,
        ),
        route,
      );
    });
  await context.test("identical texts stay on the quick check", async () => {
    await assertStyleRoute(
      withHeadStyles(
        fixture,
        "<style>.entry{color:red}</style>",
        "<style>.entry{color:red}</style>",
      ),
      "fast",
    );
  });
});
