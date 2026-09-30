import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { MoklyError, isMoklyError } from "../dist/errors.js";

const authoring = path.resolve("src/authoring");
const facadeImports = [
  "src/index.ts",
  "src/errors.ts",
  "src/components/definition.ts",
  "src/build/consumer_entry.ts",
];

test("authoring and consumer facade modules never use private symbols across the bundle boundary", () => {
  const authoringFiles = readdirSync(authoring, { recursive: true })
    .filter((filename): filename is string => typeof filename === "string")
    .filter((filename) => /\.tsx?$/u.test(filename))
    .map((filename) => path.join(authoring, filename));
  for (const filename of [...authoringFiles, ...facadeImports]) {
    const source = readFileSync(filename, "utf8");
    assert.doesNotMatch(
      source,
      /\bSymbol\s*\(/u,
      `${filename}: definitions leave the consumer bundle, so CLI-read markers must use Symbol.for or plain data`,
    );
  }
});

test("cross-copy error branding requires a known code and an intact detail", () => {
  assert.equal(
    isMoklyError(new MoklyError("build-invalid", "bad folder")),
    true,
  );
  assert.equal(
    isMoklyError({
      [Symbol.for("mokly.error")]: true,
      code: "not-a-mokly-code",
      detail: "bad folder",
      message: "[mokly/not-a-mokly-code] bad folder",
    }),
    false,
  );
  assert.equal(isMoklyError(new Error("bad folder")), false);
});
