/**
 * The drawings' TypeScript program: the mockup workspace's compiler options
 * with React's types only, over every authored source outside `_tests_`. The
 * source policy reads syntax, imports and value types from it, and a drawing
 * that uses a Node global fails its type check.
 */

import { readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import type { SourceFile } from "./source-policy";

const workspace = path.resolve(import.meta.dirname, "../../../../apps/mockups");
const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const sourceRoot = path.resolve(import.meta.dirname, "..");

/**
 * Parse the workspace's `tsconfig.json` with these overrides. Tests, scripts
 * and configuration keep its own Node types.
 */
export function workspaceOptions(
  overrides: ts.CompilerOptions = {},
): ts.CompilerOptions {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(workspace, "tsconfig.json"),
    overrides,
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  if (!config || config.errors.length)
    throw new Error("Cannot load the mockup TypeScript options");
  return config.options;
}

/** The drawings' options: React's ambient types, and no Node types. */
export const drawingOptions = workspaceOptions({
  types: ["react", "react-dom"],
});

/** The declarations that a drawing's side-effect stylesheet imports need. */
export const drawingDeclarations = [path.join(workspace, "src/styles.d.ts")];

/** Scan all supported authored script files while keeping test fixtures exempt. */
export function authoredSourcePaths(paths: readonly string[]): string[] {
  return paths.filter(
    (file) =>
      !file.replaceAll("\\", "/").split("/").includes("_tests_") &&
      /\.(?:ts|tsx|js|jsx|mjs|mts)$/.test(file),
  );
}

/** Every authored source under `docs/mockups/src`, relative to that root. */
export function drawingPaths(): string[] {
  return authoredSourcePaths(
    readdirSync(sourceRoot, { recursive: true, encoding: "utf8" }),
  ).sort();
}

const physicalSources = new Map<string, ts.SourceFile>();
let previous: ts.Program | undefined;

/** Preserve JavaScript's JSDoc types while parsing the same JSX expressions. */
function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return /\.(?:js|jsx|mjs)$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
}

/**
 * The program over every drawing, or over virtual fixture drawings that
 * share the drawings' options, libraries and public package mappings.
 */
export function createDrawingsProgram(
  fixtures?: readonly SourceFile[],
): ts.Program {
  const virtual = new Map(
    fixtures?.map((file) => [
      path.resolve(repositoryRoot, file.path),
      file.text,
    ]),
  );
  const host = ts.createCompilerHost(drawingOptions);
  const virtualSources = new Map<string, ts.SourceFile>();
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const directoryExists = host.directoryExists?.bind(host);
  host.fileExists = (file) =>
    virtual.has(path.resolve(file)) || fileExists(file);
  host.readFile = (file) => virtual.get(path.resolve(file)) ?? readFile(file);
  host.directoryExists = (directory) =>
    [...virtual.keys()].some((file) =>
      file.startsWith(path.resolve(directory) + path.sep),
    ) ||
    (directoryExists?.(directory) ?? false);
  const readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, onError, create) => {
    const absolute = path.resolve(file);
    const text = virtual.get(absolute);
    if (text !== undefined) {
      let source = virtualSources.get(absolute);
      if (!source) {
        source = ts.createSourceFile(
          absolute,
          text,
          ts.ScriptTarget.Latest,
          true,
          scriptKind(file),
        );
        virtualSources.set(absolute, source);
      }
      return source;
    }
    const cached = physicalSources.get(absolute);
    if (cached) return cached;
    const source = /\.(?:js|jsx|mjs)$/.test(file)
      ? ts.createSourceFile(
          absolute,
          ts.sys.readFile(absolute) ?? "",
          ts.ScriptTarget.Latest,
          true,
          scriptKind(file),
        )
      : readSource(file, language, onError, create);
    if (source) physicalSources.set(absolute, source);
    return source;
  };
  const roots = fixtures
    ? [...drawingDeclarations, ...virtual.keys()]
    : [
        ...drawingPaths().map((file) => path.join(sourceRoot, file)),
        ...drawingDeclarations,
      ];
  const program = ts.createProgram({
    rootNames: roots,
    options: drawingOptions,
    host,
    oldProgram: previous,
  });
  previous = program;
  return program;
}

/** Reject parse failures before applying checks to a typed syntax tree. */
export function parseDeterministicSource(
  file: SourceFile,
  program = createDrawingsProgram([file]),
) {
  const source = program.getSourceFile(path.resolve(repositoryRoot, file.path));
  if (!source)
    throw new Error("Drawing is outside the policy program: " + file.path);
  return {
    source,
    checker: program.getTypeChecker(),
    diagnostics: program.getSyntacticDiagnostics(source),
  };
}
