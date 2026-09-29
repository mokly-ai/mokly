import ts from "typescript";

/** Read a literal module specifier without accepting computed paths. */
export function stringSpecifier(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** Test a TypeScript modifier without depending on node-specific fields. */
export function hasModifier(node, kind) {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((item) => item.kind === kind)
  );
}

/** Select the parser grammar associated with one workspace module. */
export function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/u.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
