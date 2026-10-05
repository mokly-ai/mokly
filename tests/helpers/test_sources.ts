import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { repositoryRoot } from "./fixture.js";

/** Parse test sources without treating code samples in strings as live code. */
export function parseTestSource(source: string, filename = "sample.ts") {
  return ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
}

/** Visit each syntax node once, including the source root. */
export function visitTestSource(
  node: ts.Node,
  visit: (node: ts.Node) => void,
): void {
  visit(node);
  ts.forEachChild(node, (child) => visitTestSource(child, visit));
}

/** All TypeScript test inputs, including helpers and viewer package tests. */
export function testSources(): readonly ts.SourceFile[] {
  return ["tests", "packages/viewer/tests"].flatMap((directory) => {
    const root = path.join(repositoryRoot, directory);
    return readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/u.test(entry.name))
      .map((entry) => {
        const filename = path.join(entry.parentPath, entry.name);
        return parseTestSource(readFileSync(filename, "utf8"), filename);
      });
  });
}

/** A stable source location for a failed repository guard. */
export function testSourceLocation(node: ts.Node): string {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(repositoryRoot, source.fileName)}:${line + 1}`;
}
