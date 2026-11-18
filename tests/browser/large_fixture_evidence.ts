import fs from "node:fs/promises";
import path from "node:path";

import type { TestInfo } from "@playwright/test";

/** Preserve harness evidence before removal, including for later fixture failures. */
export async function cleanupLargeFixture(
  root: string,
  testInfo: TestInfo,
  completed: boolean,
) {
  let cleanupFailure: { error: unknown } | undefined;
  const diagnostic = (error: unknown) => {
    testInfo.annotations.push({
      type: "large-fixture-evidence-error",
      description: error instanceof Error ? error.message : String(error),
    });
  };
  try {
    const directory = path.join(root, ".context");
    const files = await fs.readdir(directory, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !/\.(?:json|log)$/u.test(file.name)) continue;
      try {
        await testInfo.attach(`large-fixture-${file.name}`, {
          path: path.join(directory, file.name),
          contentType: file.name.endsWith(".json")
            ? "application/json"
            : "text/plain",
        });
      } catch (error) {
        diagnostic(error);
      }
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      diagnostic(error);
  } finally {
    try {
      await fs.rm(root, { recursive: true, force: true });
    } catch (error) {
      if (completed) cleanupFailure = { error };
      else diagnostic(error);
    }
  }
  if (cleanupFailure) throw cleanupFailure.error;
}
