import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  authoredSourcePaths,
  createDrawingsProgram,
  drawingPaths,
} from "./deterministic-source-parser";
import { deterministicSourceViolations } from "./deterministic-source-policy";

const path = "docs/mockups/src/screens/fixture.tsx";
const declarations = "declare const d: Date; declare const date: Date; ";

for (const text of [
  "process.env.THEME",
  'process["env"]["THEME"]',
  "process.cwd()",
  "import.meta.url",
  "Date.now()",
  "Math.random()",
  "new Date()",
  "new Date",
  "date.toLocaleString()",
  'date.toLocaleDateString("en-GB", { dateStyle: "short" })',
  'date.toLocaleTimeString("en-GB")',
  'new Intl.DateTimeFormat("en-GB")',
  'Intl.DateTimeFormat("en-GB", { dateStyle: "short" })',
  'date.toLocaleString("en-GB", { timeZone: undefined })',
  "const { env } = process;",
  "globalThis.process.env.X",
  "const p = process; p.env",
  "process.version",
  "import.meta.dirname",
  "import.meta.filename",
  "const { url } = import.meta;",
  "Date()",
  'Date("2026-10-08T00:00:00Z")',
  "const { now } = Date;",
  "const Clock = Date; new Clock()",
  "const { random } = Math; random()",
  "const m = Math; m.random()",
  "const { DateTimeFormat } = Intl;",
  "const i = Intl; i.DateTimeFormat()",
  "crypto.randomUUID()",
  "performance.now()",
  "const p = performance; p.now()",
  "window.crypto.randomUUID()",
  "self.performance.now()",
  "globalThis.Date.now()",
  "window.Math.random()",
  "self.Date()",
  "window.process.env.X",
  'globalThis["crypto"].randomUUID()',
  "const { Date: Clock } = globalThis;",
  "d.toDateString()",
  "d.toTimeString()",
  "d.getHours()",
  "d.getDate()",
  "d.getDay()",
  "d.getMonth()",
  "d.getFullYear()",
  "d.getMinutes()",
  "d.getSeconds()",
  "d.getMilliseconds()",
  "d.getTimezoneOffset()",
  "d.getYear()",
  "const hour = d.getHours;",
])
  test("source policy rejects " + text, () => {
    assert.ok(
      deterministicSourceViolations({ path, text: declarations + text })
        .length > 0,
    );
  });

test("explicit dates and time zones, strings, comments and test fixtures pass", () => {
  for (const text of [
    'new Date("2026-10-08T00:00:00Z")',
    'date.toLocaleString("en-GB", { timeZone: "UTC" })',
    'date.toLocaleDateString("en-GB", { timeZone: "UTC" })',
    'date.toLocaleTimeString("en-GB", { timeZone: "UTC" })',
    'new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" })',
    'Intl.DateTimeFormat("en-GB", { "timeZone": "UTC" })',
    'const timeZone = "UTC"; date.toLocaleString("en-GB", { timeZone });',
    '// Date.now()\nconst label = "process.env and import.meta.url";',
    "d.getUTCHours(); d.getUTCDate(); d.getUTCDay(); d.getUTCMonth(); d.getUTCFullYear(); d.getUTCMinutes(); d.getUTCSeconds(); d.getUTCMilliseconds(); d.getTime(); d.toISOString()",
    'new globalThis.Date("2026-10-08T00:00:00Z")',
    "Date.UTC(2026, 9, 8); Math.round(2.5); Math.PI;",
    'new window.Intl.DateTimeFormat("en-GB", { timeZone: "UTC" })',
    'type When = Date; const labels = { process: "process", crypto: "crypto", performance: "performance" };',
  ])
    assert.deepEqual(
      deterministicSourceViolations({ path, text: declarations + text }),
      [],
    );
  assert.deepEqual(
    deterministicSourceViolations({
      path: "docs/mockups/src/_tests_/fixture.tsx",
      text: "new Date()",
    }),
    [],
  );
});

test("source discovery covers every supported script extension and excludes tests", () => {
  const files = ["ts", "tsx", "js", "jsx", "mjs", "mts"].map(
    (extension) => "screens/screen." + extension,
  );
  assert.deepEqual(
    authoredSourcePaths([...files, "_tests_/fixture.mjs", "screens/image.svg"]),
    files,
  );
});

test("all authored mockup sources use deterministic input values", () => {
  const root = resolve(import.meta.dirname, "..");
  const program = createDrawingsProgram();
  const problems = drawingPaths().flatMap((file) =>
    deterministicSourceViolations(
      {
        path: "docs/mockups/src/" + file,
        text: readFileSync(resolve(root, file), "utf8"),
      },
      program,
    ),
  );
  assert.deepEqual(problems, []);
});
