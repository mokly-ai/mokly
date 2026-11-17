import assert from "node:assert/strict";
import test from "node:test";

import { deterministicSourceViolations } from "./deterministic-source-policy";

const path = "docs/mockups/src/screens/fixture.tsx";
const declarations = "declare const d: Date; ";

for (const extension of ["js", "jsx", "mjs", "tsx"])
  for (const text of [
    "const node = <p>{Date()}</p>;",
    "const node = <p>{crypto.randomUUID()}</p>;",
    "const node = <p>{performance.now()}</p>;",
  ])
    test(
      "JSX source rejects ambient input in ." + extension + ": " + text,
      () => {
        assert.ok(
          deterministicSourceViolations({
            path: "docs/mockups/src/screens/fixture." + extension,
            text,
          }).length > 0,
        );
      },
    );

for (const extension of ["ts", "tsx", "js", "jsx", "mjs", "mts"])
  test("source policy rejects parse errors in ." + extension, () => {
    assert.ok(
      deterministicSourceViolations({
        path: "docs/mockups/src/screens/fixture." + extension,
        text: "export const broken = ;",
      }).some((problem) => problem.includes("parse error")),
    );
  });

for (const global of ["globalThis", "window", "self"])
  for (const text of [
    `(${global} as any).process.env.X`,
    `(${global} satisfies object).performance.now()`,
    `${global}!.crypto.randomUUID()`,
    `const g = ${global}; g.process`,
    `const { process: p } = ${global}; p.env`,
    `const { navigator } = ${global};`,
  ])
    test(
      "source policy rejects wrapped access and global aliases: " + text,
      () => {
        assert.ok(
          deterministicSourceViolations({ path, text: declarations + text })
            .length > 0,
        );
      },
    );

for (const text of [
  "(Date as any).now()",
  "(Math satisfies object).random()",
  "Date!()",
  "new (Date as any)()",
  "const g = (globalThis as any); g.process",
  "const d = (Date satisfies object); d.now()",
  'import { env } from "node:process";',
  'import { randomUUID } from "node:crypto";',
  'import { homedir } from "node:os";',
  'import { homedir } from "os";',
  'import "node:future-builtin";',
  'import "fs/promises";',
  'export { env } from "node:process";',
  'export * from "crypto";',
  'const os = await import("node:os");',
  'const os = require("os");',
  'import os = require("node:os");',
  'type Os = import("node:os");',
  "d.setHours(1)",
  "d.setDate(1)",
  "d.setMonth(1)",
  "d.setFullYear(2026)",
  "d.setMinutes(1)",
  "d.setSeconds(1)",
  "d.setMilliseconds(1)",
  "d.setYear(26)",
  'd["setHours"](1)',
  "const setter = d.setHours;",
  "(d.toLocaleString as any)()",
  "(d.toLocaleDateString satisfies Function)()",
  "d.toLocaleTimeString!()",
  'd.toLocaleString("en-GB", { timeZone: (undefined as any) })',
  'new Intl.DateTimeFormat("en-GB", { timeZone: null! })',
  "type F = typeof Date;",
  "const process = {}; use(process);",
  "const performance = {}; use(performance);",
  "const crypto = {}; use(crypto);",
])
  test("source policy rejects the indirect form: " + text, () => {
    assert.ok(
      deterministicSourceViolations({ path, text: declarations + text })
        .length > 0,
    );
  });

test("direct deterministic access and supported types stay allowed", () => {
  for (const text of [
    'const node = <p>{"Fixture"}</p>;',
    'new (globalThis.Date as any)("2026-10-08T00:00:00Z")',
    "(Math satisfies object).round(1.2)",
    'd.toLocaleString("en-GB", ({ timeZone: "UTC" } as const));',
    'd.toLocaleString("en-GB", ({ timeZone: "UTC" } satisfies object));',
    'd.toLocaleString("en-GB", { timeZone: "UTC" }!);',
    "d.setUTCHours(1); d.setUTCDate(1); d.setUTCMonth(1); d.setUTCFullYear(2026); d.setUTCMinutes(1); d.setUTCSeconds(1); d.setUTCMilliseconds(1); d.setTime(0);",
    "type When = Date; const dates: Date[] = [];",
    'import { defineScreen } from "@mokly/mokly";',
    'import { Screen } from "./screen";',
    'import "os-package";',
  ])
    assert.deepEqual(
      deterministicSourceViolations({ path, text: declarations + text }),
      [],
      text,
    );
});

for (const extension of ["js", "jsx", "mjs", "tsx"])
  test("explicit JSX input passes in ." + extension, () => {
    assert.deepEqual(
      deterministicSourceViolations({
        path: "docs/mockups/src/screens/fixture." + extension,
        text: 'const node = <p>{"Fixture"}</p>;',
      }),
      [],
    );
  });
