import assert from "node:assert/strict";
import test from "node:test";

import { deterministicSourceViolations } from "./deterministic-source-policy";

const path = "docs/mockups/src/screens/typed-fixture.tsx";
const declarations =
  "declare const d: Date; declare const count: number; declare const label: string; declare const input: string; ";

for (const text of [
  "new Date(2026, 9, 12)",
  "new Date(2026, 9)",
  'new Date("2026-10-12T09:30:00")',
  'new Date("2026-10-12 09:30:00")',
  'Date.parse("2026-10-12T09:30:00")',
  "new Date(input)",
  "Date.parse(input)",
  'const stamp = "2026-10-12T09:30:00"; new Date(stamp)',
  'const stamp = "2026-10-12T09:30:00"; Date.parse(stamp)',
  'const values = { stamp: "2026-10-12T09:30:00Z" }; new Date(values.stamp)',
  'const values = { stamp: input as "2026-10-12T09:30:00Z" } as const; new Date(values.stamp)',
  "String(d)",
  "new String(d)",
  "d.toString()",
  "const stringify = d.toString;",
  "`${d}`",
  '"Created " + d',
  'd + " created"',
  'let text = "Created "; text += d;',
  "count.toLocaleString()",
  "label.toLocaleString()",
  'label.localeCompare("a")',
  'label.localeCompare("a", undefined)',
  'const locale = "en-US"; count.toLocaleString(locale)',
  'count.toLocaleString(["en-US"])',
  'd.toLocaleString(undefined, { timeZone: "UTC" })',
  'd.toLocaleDateString(undefined, { timeZone: "UTC" })',
  'd.toLocaleTimeString(undefined, { timeZone: "UTC" })',
  "d.getHours()",
  "d.setHours(9)",
  "function draw(value: Date) { return String(value); }",
  "const stringify = String; stringify(d)",
  "const { getHours } = d;",
  "const { setHours: changeHour } = d;",
  "const { toString: format } = d;",
  'const method = "getHours"; d[method]()',
  "declare const maybeDate: Date | undefined; `${maybeDate}`",
  'const parse = Date.parse; parse("2026-10-12T09:30:00")',
  "const format = count.toLocaleString; format()",
  "const Formatter = Intl.NumberFormat; new Formatter()",
  'Intl.DateTimeFormat(undefined, { timeZone: "UTC" })',
])
  test("typed source policy rejects " + text, () => {
    assert.ok(
      deterministicSourceViolations({ path, text: declarations + text })
        .length > 0,
    );
  });

for (const name of [
  "Collator",
  "NumberFormat",
  "DateTimeFormat",
  "PluralRules",
  "RelativeTimeFormat",
  "ListFormat",
  "DisplayNames",
  "Segmenter",
  "Locale",
])
  test("Intl requires a literal locale: " + name, () => {
    const text = `new Intl.${name}(undefined, { timeZone: "UTC" })`;
    assert.ok(
      deterministicSourceViolations({ path, text }).some((problem) =>
        problem.includes("locale"),
      ),
    );
  });

for (const text of [
  'new Date("2026-10-12T09:30:00Z")',
  'new Date("2026-10-12T09:30:00+01:00")',
  'new Date("2026-10-12T09:30:00-0430")',
  'new Date("2026-10-12")',
  "new Date(0)",
  'const stamp = "2026-10-12T09:30:00Z"; new Date(stamp)',
  'const stamp: string = "2026-10-12T09:30:00Z"; Date.parse(stamp)',
  'const values = { stamp: "2026-10-12T09:30:00Z" } as const; new Date(values.stamp)',
  'enum Times { Published = "2026-10-12T09:30:00Z" }; new Date(Times.Published)',
  'const day = "2026-10-12"; const stamp = day + "T09:30:00Z"; new Date(stamp)',
  'Date.parse("2026-10-12T09:30:00Z")',
  'const day = "2026-10-12"; new Date(`${day}T09:30:00Z`)',
  'const parse = Date.parse; parse("2026-10-12T09:30:00Z")',
  'd.toLocaleString("en-US", { timeZone: "UTC" })',
  'd.toLocaleDateString("en-US", { timeZone: "Europe/London" })',
  'd.toLocaleTimeString("en-US", { timeZone: "UTC" })',
  'new Intl.DateTimeFormat("en-US", { timeZone: "UTC" })',
  'new Intl.NumberFormat("en-US")',
  'Intl.NumberFormat.supportedLocalesOf(["en-US"])',
  'Intl.DateTimeFormat.supportedLocalesOf(["en-US"])',
  "class Date { constructor(value: number, other: number) {} } new Date(1, 2)",
  'count.toLocaleString("en-US")',
  'label.localeCompare("a", "en-US")',
  "d.getUTCHours(); d.setUTCHours(9); d.toISOString(); d.getTime();",
  'count.toString(); `${count}`; "Count " + count;',
  "const calendar = { getHours: () => 9, setHours: (hour: number) => hour }; calendar.getHours(); calendar.setHours(9);",
  'const method = "getUTCHours"; d[method]()',
  "const calendar = { getHours: () => 9 }; const { getHours } = calendar; getHours();",
])
  test("typed source policy accepts " + text, () => {
    assert.deepEqual(
      deterministicSourceViolations({
        path,
        text: "export {}; " + declarations + text,
      }),
      [],
    );
  });
