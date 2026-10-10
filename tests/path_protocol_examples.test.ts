import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import ts from "typescript";

import { repositoryRoot } from "./helpers/fixture.js";

test("the stylesheet declaration example uses current path authoring", async (t) => {
  await checkExample(t, "mokly-component-stylesheets.md");
});

test("the comparison contract uses public path identities for reasons and consumers", async (t) => {
  await checkExample(
    t,
    "mokly-component-comparison-records.md",
    `import type * as Public from "@mokly/viewer/data";
import type { ManifestComponentVariant } from "@mokly/viewer";
import type { ScreenReview, ReviewState, ViewReview,
  DependencyAnalysis, Viewport, ColorScheme } from "@mokly/viewer/data";`,
    `declare const publicReason: Public.EntryChangeReason;
declare const describedReason: EntryChangeReason;
const fromPublicReason: EntryChangeReason = publicReason;
const toPublicReason: Public.EntryChangeReason = describedReason;
declare const publicConsumer: Public.AffectedConsumer["consumer"];
declare const describedConsumer: AffectedConsumer["consumer"];
const fromPublicConsumer: AffectedConsumer["consumer"] = publicConsumer;
const toPublicConsumer: Public.AffectedConsumer["consumer"] = describedConsumer;`,
  );
});

async function checkExample(
  t: TestContext,
  name: string,
  imports = "",
  assertions = "",
): Promise<void> {
  const document = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol", name),
    "utf8",
  );
  const snippet = /```ts\n([\s\S]*?)\n```/u.exec(document)?.[1];
  assert.ok(snippet, `${name} must contain its TypeScript contract`);
  const directory = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/protocol-example-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "example.ts");
  await fs.writeFile(file, `${imports}\n${snippet}\n${assertions}\n`);
  const program = ts.createProgram([file], {
    noEmit: true,
    strict: true,
    exactOptionalPropertyTypes: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
  assert.deepEqual(diagnostics, [], name);
}
