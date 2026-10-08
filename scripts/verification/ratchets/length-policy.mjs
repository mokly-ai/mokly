import ts from "typescript";

import { countPhysicalLines } from "./lines.mjs";

export { countPhysicalLines };

const SOURCE_LIMIT = 300;
export const PROTOCOL_LIMIT = 250;
const PROTOCOL_PREFIX = "docs/protocol/";

/** Read and validate the reviewed exact caps in the JSON cap table. */
export function parseProtocolCapTable(source, label) {
  const text = source.toString("utf8");
  let table;
  try {
    table = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
  if (table === null || typeof table !== "object" || Array.isArray(table))
    throw new Error(`${label} must contain one JSON object`);
  const caps = {};
  let previous;
  for (const name of topLevelKeys(text)) {
    if (!isProtocolDocumentName(name))
      throw new Error(
        `${label} has a key that is not a Markdown path relative to docs/protocol: ${name}`,
      );
    if (Object.hasOwn(caps, name))
      throw new Error(`${label} repeats the cap for ${name}`);
    if (previous !== undefined && name < previous)
      throw new Error(
        `${label} keys are not sorted: ${name} follows ${previous}`,
      );
    const value = table[name];
    if (!Number.isSafeInteger(value) || value <= PROTOCOL_LIMIT)
      throw new Error(
        `${label} has an invalid cap for ${name}; use a safe integer above ${PROTOCOL_LIMIT}`,
      );
    caps[name] = value;
    previous = name;
  }
  return caps;
}

/** Read the legacy `oversizedCaps` table from the former protocol size test. */
export function parseLegacyProtocolCaps(source, label) {
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

/**
 * List the member names of a parsed top-level JSON object in source order.
 * `JSON.parse` keeps only the last of repeated names, so the table reads them
 * from the text: a string at depth one followed by a colon is a member name.
 */
function topLevelKeys(text) {
  const keys = [];
  const colon = /\s*:/uy;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "{" || character === "[") depth += 1;
    else if (character === "}" || character === "]") depth -= 1;
    else if (character === '"') {
      const end = closingQuote(text, index);
      colon.lastIndex = end + 1;
      if (depth === 1 && colon.test(text))
        keys.push(JSON.parse(text.slice(index, end + 1)));
      index = end;
    }
  }
  return keys;
}

/** Index of the quote that closes the valid JSON string starting at `start`. */
function closingQuote(text, start) {
  let index = start + 1;
  while (text[index] !== '"') index += text[index] === "\\" ? 2 : 1;
  return index;
}

/** Whether a key names a Markdown document by a clean path below docs/protocol. */
function isProtocolDocumentName(name) {
  return (
    name.endsWith(".md") &&
    name
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
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
