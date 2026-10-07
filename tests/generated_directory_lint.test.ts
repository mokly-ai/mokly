import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

const ruleId = "mokly/no-directory-literals";
const eslint = new ESLint();
const probes = [
  "src/generated-directory-lint-probe.ts",
  "packages/viewer/src/generated-directory-lint-probe.tsx",
  "scripts/preview/generated-directory-lint-probe.mjs",
];

test("regular-expression directory names cannot bypass lint", async () => {
  const [result] = await eslint.lintText(
    String.raw`export const route = /^mokly-generated\//;`,
    { filePath: probes[0]! },
  );
  assert.deepEqual(
    result!.messages.map((entry) => entry.ruleId),
    [ruleId],
  );
});

for (const [directory, message] of [
  [
    "generated",
    "Import GENERATED_DIRECTORY instead of spelling the output directory.",
  ],
  [
    "viewer",
    "Import VIEWER_DIRECTORY instead of spelling the viewer directory.",
  ],
]) {
  for (const filePath of probes) {
    test(`directory literals are rejected through the local rule in ${filePath} (${directory})`, async () => {
      for (const source of [
        '"mokly-generated"',
        '"static/mokly-generated/screen.html"',
        '`static/mokly-generated/${"screen.html"}`',
        String.raw`"mokly\u002dgenerated"`,
        String.raw`"\x6dokly-generated"`,
        "`mokly\\u002dgenerated`",
        "`\\u{6d}okly-generated`",
        String.raw`/^mokly-generated\//`,
        String.raw`/^static\/mokly-generated\/page/`,
        String.raw`/^mokly\-generated\//`,
        String.raw`/^\x6dokly-generated\//`,
        String.raw`/^mokly\u002Dgenerated\//`,
        String.raw`/^\u{00006d}okly-generated\//u`,
      ]) {
        const expression = source.replaceAll("generated", directory!);
        const [result] = await eslint.lintText(
          `export const route = ${expression};`,
          { filePath },
        );
        assert.ok(result, filePath);
        assert.equal(result.fatalErrorCount, 0, expression);
        assert.deepEqual(
          result.messages
            .filter((entry) => entry.ruleId === ruleId)
            .map(({ ruleId, message, severity, fatal }) => ({
              ruleId,
              message,
              severity,
              fatal: fatal ?? false,
            })),
          [{ ruleId, message, severity: 2, fatal: false }],
          expression,
        );
      }
    });

    test(`constants and unrelated text remain valid in ${filePath} (${directory})`, async () => {
      const [result] = await eslint.lintText(
        [
          'import { GENERATED_DIRECTORY, VIEWER_DIRECTORY } from "@mokly/viewer/data";',
          "// mokly-generated is allowed in a comment.",
          "export const route = `${GENERATED_DIRECTORY}/screen.html`;",
          "export const viewer = `${VIEWER_DIRECTORY}/catalogue.json`;",
          'export const label = "generated output";',
          String.raw`export const pattern = /mokly\\x2dgenerated/;`,
        ].join("\n"),
        { filePath },
      );
      assert.ok(result, filePath);
      assert.deepEqual(result.messages, []);
    });
  }
}

test("each offending template segment is reported only once", async () => {
  const [result] = await eslint.lintText(
    'export const route = `mokly-generated/${"page"}/mokly-generated`;',
    { filePath: probes[0]! },
  );
  assert.deepEqual(
    result!.messages.map((entry) => entry.ruleId),
    [ruleId, ruleId],
  );
});

test("only the defining module is exempt inside production roots", async () => {
  for (const [filePath, expected] of [
    ["packages/viewer/src/catalogue/delivery_paths.ts", []],
    ["packages/viewer/src/catalogue/other_paths.ts", [ruleId]],
    ["src/catalogue/delivery_paths.ts", [ruleId]],
    ["tests/generated-directory-lint-probe.ts", []],
  ] as const) {
    const [result] = await eslint.lintText(
      'export const GENERATED_DIRECTORY = "mokly-generated";',
      { filePath },
    );
    assert.deepEqual(
      result!.messages.map((entry) => entry.ruleId),
      expected,
      filePath,
    );
  }
});

test("later no-restricted-syntax options cannot replace the directory rule", async () => {
  const merged = new ESLint({
    overrideConfig: {
      files: ["src/config/**/*.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.property.name='localeCompare']",
            message: "Use compareCodeUnits for source paths.",
          },
        ],
      },
    },
  });
  const [result] = await merged.lintText(
    'export const route = "mokly-generated"; route.localeCompare("page");',
    { filePath: "src/config/generated-directory-lint-probe.ts" },
  );
  assert.deepEqual(
    result!.messages.map((entry) => entry.ruleId).sort(),
    [ruleId, "no-restricted-syntax"].sort(),
  );
});
