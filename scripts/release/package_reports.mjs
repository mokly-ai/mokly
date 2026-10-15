import assert from "node:assert/strict";

import { nativeTarget } from "./targets.mjs";

const METADATA = ["package.json", "LICENSE", "README.md"];
export function validateNativeReport(report, name) {
  const { executable } = nativeTarget(name);
  const required = [...METADATA, `bin/${executable}`].sort();
  assert.deepEqual(
    report.files.map(({ path }) => path).sort(),
    required,
    `${name} must contain exactly its binary and package metadata`,
  );
  assert.ok(
    report.files.every(({ size }) => Number.isSafeInteger(size) && size > 0),
  );
}

export function validateCliReport(report) {
  const files = report.files.map(({ path }) => path);
  for (const file of [
    ...METADATA,
    "CHANGELOG.md",
    "config.schema.json",
    "bin/mokly.mjs",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/sidecar.js",
    "dist/sidecar/postcss-worker.js",
    "dist/runtime.mjs",
    "dist/shim.mjs",
    "dist/execution.mjs",
    "dist/version.mjs",
    "dist/platform.mjs",
    "docs/protocol/mokly-package.md",
    "docs/protocol/mokly-upload-exchange.md",
    "docs/protocol/fixtures/upload-plan-v1.json",
    "docs/protocol/fixtures/export-ownership-v3.json",
    "docs/guides/start/install.md",
  ])
    assert.ok(files.includes(file), `CLI package is missing ${file}`);
  for (const file of files) {
    assert.ok(
      METADATA.includes(file) ||
        file === "CHANGELOG.md" ||
        file === "config.schema.json" ||
        file === "bin/mokly.mjs" ||
        /^dist\/.+\.(?:js|mjs|ts)$/.test(file) ||
        /^docs\/(?:guides|protocol)\/.+\.(?:md|json)$/.test(file),
      `CLI contains non-allowlisted path ${file}`,
    );
  }
}
