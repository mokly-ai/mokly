import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";

const UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** A count written in digits or as English words up to ninety-nine. */
function count(written: string): number {
  if (/^\d+$/u.test(written)) return Number(written);
  const [tens, unit] = written.toLowerCase().split("-");
  if (unit === undefined && UNITS.includes(tens!)) return UNITS.indexOf(tens!);
  const ten = TENS.indexOf(tens!);
  const one = unit === undefined ? 0 : UNITS.indexOf(unit);
  assert.ok(ten >= 0 && one >= 0 && one < 10, `unreadable count ${written}`);
  return (ten + 2) * 10 + one;
}

/** Every count a sentence states, in order, with whitespace normalized. */
async function stated(file: string, pattern: RegExp): Promise<number[]> {
  const text = (
    await fs.readFile(path.join(repositoryRoot, file), "utf8")
  ).replace(/\s+/gu, " ");
  const matches = [...text.matchAll(pattern)];
  assert.equal(matches.length, 1, `${file}: ${pattern}`);
  return matches[0]!.slice(1).map(count);
}

test("documented design-screen counts match the compiled catalogue", async () => {
  const { manifest } = await designCatalogue;
  const designs = manifest.entries.flatMap((entry) =>
    entry.kind === "screen" && entry.path.startsWith("design/") ? [entry] : [],
  );
  const components = designs.filter((entry) =>
    entry.path.startsWith("design/components/"),
  );
  const dual = designs.filter((entry) => entry.colorSchemes.includes("dark"));
  const dualBrowse = dual.filter((entry) =>
    entry.path.startsWith("design/browse/views/"),
  );
  const variants = dualBrowse.filter((entry) => entry.variantOf !== undefined);
  const shell = designs.length - components.length;
  const readme = "examples/basic/README.md";
  const word = "([A-Za-z]+(?:-[a-z]+)?)";
  for (const [file, pattern, expected] of [
    [readme, /Mokly's (\d+) design screens/gu, [designs.length]],
    [readme, /cover all (\d+) design screens/gu, [designs.length]],
    [
      readme,
      new RegExp(
        `Its ${word} Browse, page, publication, appearance and Changes screens`,
        "gu",
      ),
      [shell],
    ],
    [
      readme,
      new RegExp(`${word} component explorer screens add`, "gu"),
      [components.length],
    ],
    [
      readme,
      /scoped to the (\d+) component-design routes/gu,
      [components.length],
    ],
    [
      readme,
      new RegExp(
        `${word} design screens use \`colorSchemes: \\["light"\\]\``,
        "gu",
      ),
      [designs.length - dual.length],
    ],
    [
      readme,
      new RegExp(
        `${word} screens instead inherit the catalogue's light/dark settings: ` +
          `${word} Appearance screens, ${word} Changes designs, ${word} product ` +
          `screens, and ${word} retained Welcome appearance variants`,
        "gu",
      ),
      [
        dual.length,
        dual.filter((entry) =>
          entry.path.startsWith("design/browse/appearance/"),
        ).length,
        dual.filter((entry) => entry.path.startsWith("design/changes/")).length,
        dualBrowse.length - variants.length,
        variants.length,
      ],
    ],
    [
      "docs/protocol/mokly-component-design.md",
      /All ([a-z]+-[a-z]+) component screens opt into light documents/gu,
      [components.length],
    ],
    [
      "docs/protocol/mokly-component-design.md",
      /only from the ([a-z]+-[a-z]+) component design routes/gu,
      [components.length],
    ],
    [
      "docs/protocol/mokly-design-links.md",
      /Implemented in the (\d+) Browse\/Changes design screens/gu,
      [shell],
    ],
    [
      "docs/protocol/mokly-design-links.md",
      /Those (\d+) Browse\/Changes designs retain/gu,
      [shell],
    ],
  ] as const)
    assert.deepEqual(
      await stated(file, pattern),
      expected,
      `${file}: ${pattern.source}`,
    );
  assert.equal(
    dual.length,
    dual.filter((entry) => entry.path.startsWith("design/browse/appearance/"))
      .length +
      dual.filter((entry) => entry.path.startsWith("design/changes/")).length +
      dualBrowse.length,
    "every light/dark design belongs to one documented group",
  );
});
