import assert from "node:assert/strict";
import test from "node:test";

import {
  lintProbe,
  repositoryEslint,
  requireLintRule,
} from "./helpers/lint_config.js";
import { directoryProbes, directoryRoots } from "./helpers/lint_paths.js";

const rule = "mokly/no-directory-literals";
const directories = [
  [
    "generated",
    "Import GENERATED_DIRECTORY instead of spelling the output directory.",
  ],
  [
    "viewer",
    "Import VIEWER_DIRECTORY instead of spelling the viewer directory.",
  ],
] as const;

test("the directory rule inventory includes every production root and syntax extension", () => {
  for (const root of directoryRoots)
    assert.ok(
      directoryProbes.some((file) => file.startsWith(root)),
      root,
    );
  assert.ok(
    directoryProbes.some(
      (file) => file.startsWith("src/") && file.endsWith(".tsx"),
    ),
  );
  assert.ok(
    directoryProbes.some(
      (file) =>
        file.startsWith("packages/viewer/src/") && file.endsWith(".tsx"),
    ),
  );
  assert.ok(
    directoryProbes.includes("scripts/preview/lint-coverage/nested/probe.mjs"),
  );
});

for (const filePath of directoryProbes)
  test(`both directory names are guarded in ${filePath}`, async () => {
    await requireLintRule(filePath, rule);
    for (const [name, message] of directories) {
      const expressions = [
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
      ].map((source) => source.replaceAll("generated", name));
      for (const expression of expressions) {
        const result = await lintProbe(
          `export const route = ${expression};`,
          filePath,
        );
        assert.deepEqual(
          result.messages
            .filter(({ ruleId }) => ruleId === rule)
            .map(({ ruleId, message, severity }) => ({
              ruleId,
              message,
              severity,
            })),
          [{ ruleId: rule, message, severity: 2 }],
          `${filePath}: ${expression}`,
        );
      }
    }
    const clean = await lintProbe(
      [
        'import { GENERATED_DIRECTORY, VIEWER_DIRECTORY } from "@mokly/viewer/data";',
        "export const paths = [GENERATED_DIRECTORY, `${VIEWER_DIRECTORY}/catalogue.json`];",
      ].join("\n"),
      filePath,
    );
    assert.deepEqual(clean.messages, [], filePath);
  });

test("only the directory definition module is exempt for both names", async () => {
  const owner = "packages/viewer/src/catalogue/delivery_paths.ts";
  await requireLintRule(owner, "import/first");
  const source = 'export const roots = ["mokly-generated", "mokly-viewer"];';
  assert.deepEqual((await lintProbe(source, owner)).messages, []);
  for (const file of [
    "packages/viewer/src/catalogue/lint-coverage-probe.ts",
    "src/catalogue/delivery_paths.ts",
  ]) {
    await requireLintRule(file, rule);
    assert.deepEqual(
      (await lintProbe(source, file)).messages.map(({ ruleId, message }) => ({
        ruleId,
        message,
      })),
      directories.map(([, message]) => ({ ruleId: rule, message })),
    );
  }
});

test("the real Git-ignore and generated-output ignores remain active", async () => {
  for (const file of [
    ".context/lint-coverage-probe.ts",
    "src/.mokly-cache/lint-coverage-probe.ts",
    "packages/viewer/src/.context/lint-coverage-probe.tsx",
    "examples/basic/mokly-generated/lint-coverage-probe.ts",
    "dist/lint-coverage-probe.js",
  ])
    assert.equal(await repositoryEslint.isPathIgnored(file), true, file);
});
