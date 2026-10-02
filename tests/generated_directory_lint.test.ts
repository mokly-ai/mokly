import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

test("production literals use the shared generated directory constant", async () => {
  const eslint = new ESLint();
  for (const source of [
    'const route = "mokly-generated/screen.html";',
    "const route = `static/mokly-generated/${screen}`;",
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath: "src/generated-directory-lint-probe.ts",
    });
    assert.ok(
      result!.messages.some(
        (message) => message.ruleId === "no-restricted-syntax",
      ),
      source,
    );
  }
  const [allowed] = await eslint.lintText(
    "const route = GENERATED_DIRECTORY;",
    { filePath: "src/generated-directory-lint-probe.ts" },
  );
  assert.ok(
    allowed!.messages.every(
      (message) => message.ruleId !== "no-restricted-syntax",
    ),
  );
});
