import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import { CachedBaselineBuilder } from "../dist/baseline/rebuild.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { runServerChild } from "../dist/server/child.js";
import { childUpdateMessage } from "../dist/server/update_messages.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("derived HTTP child rejects an unprepared unselected comparison without building", async (t) => {
  const fixture = await derivedFixture(t);
  await prepareReviewRepository(fixture.config, "HEAD");
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Moved baseline" }),
  );
  const movedOutput = await compileCatalogue(fixture.config);
  await fs.writeFile(
    path.join(fixture.root, "baseline-output.json"),
    JSON.stringify([...movedOutput.outputs]),
  );
  await fixture.git("add", ".");
  await fixture.git("commit", "-qm", "test: move baseline");
  const moved = await prepareReviewRepository(fixture.config, "HEAD");
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Current source" }),
  );
  const build = t.mock.method(
    CachedBaselineBuilder.prototype,
    "build",
    async () => {
      throw new Error("HTTP must never rebuild a baseline");
    },
  );
  const descriptor = Object.getOwnPropertyDescriptor(process, "send");
  let resolveReady: (port: number) => void = () => {};
  let rejectReady: (error: unknown) => void = () => {};
  const ready = new Promise<number>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  Object.defineProperty(process, "send", {
    configurable: true,
    value: (message: { type: string; port: number }) => {
      if (message.type === "ready") resolveReady(message.port);
    },
  });
  const running = runServerChild(
    fixture.config,
    0,
    "HEAD",
    1,
    false,
    false,
    fixture.baseline.manifest,
  );
  void running.catch(rejectReady);
  try {
    const port = await ready;
    const response = await fetch(
      `http://127.0.0.1:${port}/__mokly/diffs/review.json`,
    );
    assert.equal(response.status, 500);
    const failure = (await response.json()) as { details: string };
    assert.match(failure.details, /review-invalid/);
    assert.match(failure.details, /comparison is not prepared/i);
    assert.equal(build.mock.callCount(), 0);
    const sendCommit = (commit: string | null, version: number) =>
      process.emit(
        "message",
        childUpdateMessage(
          version,
          undefined,
          undefined,
          "pending",
          "evidence",
          commit,
        ),
        undefined,
      );
    const compare = async (commit: string, movedBaseline: boolean) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/__mokly/diffs/review.json`,
      );
      assert.equal(response.status, 200, await response.clone().text());
      const result = parseReviewResult(await response.json());
      assert.equal(result.baseCommit, commit);
      const view = result.screens
        .find((screen) => screen.route === "screens/home.html")!
        .views.find((view) => view.viewport === "mobile")!;
      const before = await (
        await fetch(new URL(view.beforePath!, response.url))
      ).text();
      assert.equal(before.includes("Moved baseline"), movedBaseline);
      assert.match(
        await (await fetch(new URL(view.afterPath!, response.url))).text(),
        /Current source/,
      );
    };
    sendCommit(fixture.commit, 2);
    await compare(fixture.commit, false);
    sendCommit(null, 3);
    const revoked = await fetch(
      `http://127.0.0.1:${port}/__mokly/diffs/review.json`,
    );
    assert.equal(revoked.status, 500);
    assert.match(await revoked.text(), /comparison is not prepared/i);
    sendCommit(moved.commit, 4);
    await compare(moved.commit, true);
    sendCommit(fixture.commit, 2);
    await compare(moved.commit, true);
    assert.equal(build.mock.callCount(), 0);
  } finally {
    process.emit("message", { type: "shutdown" }, undefined);
    await running;
    if (descriptor) Object.defineProperty(process, "send", descriptor);
    else delete process.send;
  }
});

test("the HTTP child module graph cannot import the baseline builder", async () => {
  const visited = new Set<string>();
  async function visit(file: string): Promise<void> {
    if (visited.has(file)) return;
    visited.add(file);
    assert.notEqual(file, path.resolve("src/baseline/rebuild.ts"));
    const source = ts.createSourceFile(
      file,
      await fs.readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
    );
    const imports: string[] = [];
    function inspect(node: ts.Node): void {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        specifier.text.startsWith(".")
      )
        imports.push(specifier.text);
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    for (const specifier of imports) {
      for (const extension of [".ts", ".tsx"]) {
        const target = path.resolve(
          path.dirname(file),
          specifier.replace(/\.js$/, extension),
        );
        const exists = await fs.stat(target).catch(() => undefined);
        if (exists?.isFile()) {
          await visit(target);
          break;
        }
      }
    }
  }
  await visit(path.resolve("src/server/child.ts"));
  assert.ok(visited.has(path.resolve("src/review/run.ts")));
});
