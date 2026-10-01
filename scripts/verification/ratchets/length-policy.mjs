import ts from "typescript";

import { countPhysicalLines } from "./lines.mjs";

export { countPhysicalLines };

export const SOURCE_LIMIT = 300;
export const PROTOCOL_LIMIT = 250;
const PROTOCOL_PREFIX = "docs/protocol/";

/** Read the reviewed exact caps from the protocol size test. */
export function parseProtocolCaps(source, label) {
  const file = ts.createSourceFile(
    label,
    source.toString("utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (declaration.name.text !== "oversizedCaps") continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer))
        throw new Error(`${label} has an invalid oversizedCaps table`);
      const caps = {};
      for (const property of initializer.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isStringLiteralLike(property.name) ||
          !ts.isNumericLiteral(property.initializer)
        )
          throw new Error(`${label} has a non-literal oversizedCaps entry`);
        const value = Number(property.initializer.text);
        if (!Number.isSafeInteger(value) || value <= PROTOCOL_LIMIT)
          throw new Error(
            `${label} has an invalid cap for ${property.name.text}`,
          );
        if (Object.hasOwn(caps, property.name.text))
          throw new Error(`${label} repeats the cap for ${property.name.text}`);
        caps[property.name.text] = value;
      }
      return caps;
    }
  }
  return undefined;
}

/** One changed-file limit, including reviewed protocol exceptions. */
export function allowedLines(file, caps = {}) {
  return file.startsWith(PROTOCOL_PREFIX) && file.endsWith(".md")
    ? (caps[file.slice(PROTOCOL_PREFIX.length)] ?? PROTOCOL_LIMIT)
    : SOURCE_LIMIT;
}

export function lengthFinding(file, source, caps = {}) {
  const lines = countPhysicalLines(source);
  const limit = allowedLines(file, caps);
  return lines > limit ? `${file}: ${lines} lines (limit ${limit})` : undefined;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  )
    current = current.expression;
  return current;
}
