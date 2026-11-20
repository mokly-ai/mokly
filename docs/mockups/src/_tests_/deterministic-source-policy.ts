/** Reject known ambient inputs in authored mockup sources; byte comparison guards compilation drift. */

import ts from "typescript";

import {
  access,
  directNamespaceUse,
  isReference,
} from "./deterministic-access";
import { checkDateValue } from "./deterministic-date-values";
import { nodeImport } from "./deterministic-import-policy";
import { checkLocale } from "./deterministic-locale-policy";
import { parseDeterministicSource } from "./deterministic-source-parser";
import type { SourceFile } from "./source-policy";

const ambient = new Set([
  "process",
  "performance",
  "crypto",
  "import.meta",
  "__dirname",
  "__filename",
  "module",
  "require",
]);
const namespaces = new Set([
  "Date",
  "Math",
  "Intl",
  "globalThis",
  "window",
  "self",
]);

/** Tests may use ambient state; authored drawings use explicit fixture input values. */
export function deterministicSourceViolations(
  file: SourceFile,
  program?: ts.Program,
): string[] {
  if (file.path.replaceAll("\\", "/").split("/").includes("_tests_")) return [];
  const { source, diagnostics, checker } = parseDeterministicSource(
    file,
    program,
  );
  const problems: string[] = [];
  for (const diagnostic of diagnostics) {
    const { line } = source.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0,
    );
    problems.push(
      file.path +
        ":" +
        (line + 1) +
        ": parse error: " +
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
  }
  if (problems.length) return problems;
  function reject(node: ts.Node, message: string) {
    const { line } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    problems.push(file.path + ":" + (line + 1) + ": " + message);
  }
  function visit(node: ts.Node) {
    const imported = nodeImport(node);
    if (imported)
      reject(imported, "Node built-in import is forbidden: " + imported.text);
    const name = access(node);
    if (name && isReference(node)) {
      if (ambient.has(name))
        reject(node, "ambient reference is forbidden: " + name);
      if (namespaces.has(name) && !directNamespaceUse(node, name))
        reject(node, "namespace alias or destructuring is forbidden: " + name);
      if (name === "Date.now" || name === "Math.random")
        reject(node, "ambient reference is forbidden: " + name);
    }
    checkDateValue(node, checker, reject);
    checkLocale(node, checker, reject);
    if (ts.isCallExpression(node)) {
      const called = access(node.expression);
      if (called === "Date")
        reject(
          node,
          "Date() reads the current clock; use new Date with an explicit value",
        );
    }
    if (ts.isNewExpression(node)) {
      const constructed = access(node.expression);
      if (constructed === "Date" && !node.arguments?.length)
        reject(node, "ambient read is forbidden: new Date()");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return problems;
}
