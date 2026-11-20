import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import {
  createDrawingsProgram,
  drawingDeclarations,
  drawingOptions,
  workspaceOptions,
} from "./deterministic-source-parser";
import { deterministicSourceViolations } from "./deterministic-source-policy";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const forbidden = [
  "__dirname",
  "__filename",
  "module",
  "require",
  "process",
  "Buffer",
  "global",
  "exports",
  "setImmediate",
];
const fixturePath = path.resolve(
  import.meta.dirname,
  "../type-boundary-fixture.tsx",
);

/** The semantic diagnostics of a drawing that reads every forbidden global. */
function fixtureDiagnostics(options: ts.CompilerOptions) {
  const text = "export const values = [" + forbidden.join(", ") + "];";
  const source = ts.createSourceFile(
    fixturePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, onError, create) =>
    path.resolve(file) === fixturePath
      ? source
      : original(file, language, onError, create);
  const program = ts.createProgram(
    [...drawingDeclarations, fixturePath],
    options,
    host,
  );
  return program.getSemanticDiagnostics(source);
}

const drawings = fixtureDiagnostics(drawingOptions);

for (const name of forbidden)
  test("the drawings typecheck rejects the Node global " + name, () => {
    assert.ok(
      drawings.some((diagnostic) =>
        ts
          .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          .includes("'" + name + "'"),
      ),
      name,
    );
  });

test("the tests and config project retains Node globals", () => {
  assert.deepEqual(fixtureDiagnostics(workspaceOptions()), []);
});

let program: ts.Program | undefined;

/** The program over every drawing, built once for this file. */
function everyDrawing(): ts.Program {
  program ??= createDrawingsProgram();
  return program;
}

test("the drawings program excludes tests and Node declarations", () => {
  assert.equal(
    everyDrawing()
      .getRootFileNames()
      .some((file) => file.includes("/_tests_/")),
    false,
  );
  assert.equal(
    everyDrawing()
      .getSourceFiles()
      .some((file) => file.fileName.includes("/@types/node/")),
    false,
  );
});

test("every drawing type-checks without Node types", () => {
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(everyDrawing())
      .map(
        (diagnostic) =>
          (diagnostic.file
            ? path.relative(repositoryRoot, diagnostic.file.fileName) + ": "
            : "") +
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    [],
  );
});

for (const text of [
  "__dirname",
  "__filename",
  "module.exports",
  "const m = module;",
  "require",
  "const load = require;",
  'require("react")',
  "globalThis.__dirname",
  'window["__filename"]',
  "self.module",
  "globalThis.require",
])
  test("source policy rejects CommonJS input: " + text, () => {
    assert.ok(
      deterministicSourceViolations({ path: fixturePath, text }).length > 0,
    );
  });
