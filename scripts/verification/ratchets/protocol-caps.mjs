import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { countPhysicalLines } from "./lines.mjs";

const CAP_TEST = "tests/protocol_doc_sizes.test.ts";
const PROTOCOL_ROOT = "docs/protocol";
const STANDARD_LIMIT = 250;

/** Read the exact `oversizedCaps` object from the protocol size test. */
function parseProtocolCaps(source, label) {
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
        if (!Number.isSafeInteger(value) || value <= STANDARD_LIMIT)
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

/** Enforce current exact caps and prevent policy growth from the baseline. */
export function protocolCapFindings({
  candidateDocuments,
  candidateCaps,
  baselineDocuments,
  baselineCaps,
  predecessors = {},
}) {
  const findings = [];
  for (const name of Object.keys(candidateDocuments).sort()) {
    const current = countPhysicalLines(candidateDocuments[name]);
    const cap = candidateCaps[name];
    if (cap === undefined && current > STANDARD_LIMIT) {
      findings.push(
        `${name}: ${current} lines; documents above ${STANDARD_LIMIT} require an exact reviewed cap`,
      );
      continue;
    }
    if (cap === undefined) continue;
    if (current <= STANDARD_LIMIT) {
      findings.push(
        `${name}: ${current} lines; remove the cap at or below ${STANDARD_LIMIT}`,
      );
    } else if (current < cap) {
      findings.push(`${name}: lower the cap to ${current} from ${cap}`);
    } else if (current > cap) {
      findings.push(`${name}: ${current} lines exceeds its ${cap}-line cap`);
    }

    const predecessor = predecessors[name] ?? name;
    if (!Object.hasOwn(baselineDocuments, predecessor)) {
      findings.push(`${name}: new documents cannot add a cap`);
      continue;
    }
    const baselineCap =
      baselineCaps === undefined
        ? bootstrapCap(baselineDocuments[predecessor])
        : baselineCaps[predecessor];
    if (baselineCap === undefined) {
      findings.push(
        `${name}: cannot add a cap; predecessor ${predecessor} was uncapped`,
      );
    } else if (cap > baselineCap) {
      findings.push(
        `${name}: cap ${cap} exceeds predecessor ${predecessor} cap ${baselineCap}`,
      );
    }
  }
  for (const name of Object.keys(candidateCaps).sort()) {
    if (!Object.hasOwn(candidateDocuments, name))
      findings.push(`${name}: stale cap has no protocol document`);
  }
  return [...new Set(findings)].sort();
}

/** Audit protocol documents and the cap table against the comparison commit. */
export function auditProtocolCaps(repositoryRoot, git) {
  const capSource = fs.readFileSync(path.join(repositoryRoot, CAP_TEST));
  const candidateCaps = parseProtocolCaps(capSource, CAP_TEST);
  if (!candidateCaps) throw new Error(`${CAP_TEST} has no oversizedCaps table`);
  const candidateDocuments = readCurrentDocuments(repositoryRoot);
  const baselineDocuments = readBaselineDocuments(git);
  const hasBaselineTable = git.baseFileExists(CAP_TEST);
  const baselineCaps = hasBaselineTable
    ? parseProtocolCaps(git.readBase(CAP_TEST), `${git.base}:${CAP_TEST}`)
    : undefined;
  if (hasBaselineTable && !baselineCaps)
    throw new Error(`${git.base}:${CAP_TEST} has no oversizedCaps table`);
  const predecessors = renamedProtocolDocuments(git);
  if (
    !hasBaselineTable &&
    Object.hasOwn(candidateDocuments, "mokly-variants.md") &&
    Object.hasOwn(baselineDocuments, "mokly-screen-variants.md")
  )
    predecessors["mokly-variants.md"] = "mokly-screen-variants.md";
  return {
    findings: protocolCapFindings({
      candidateDocuments,
      candidateCaps,
      baselineDocuments,
      baselineCaps,
      predecessors,
    }),
    summary: `${Object.keys(candidateDocuments).length} protocol document(s) and ${Object.keys(candidateCaps).length} cap(s)`,
  };
}

function readCurrentDocuments(repositoryRoot) {
  const directory = path.join(repositoryRoot, PROTOCOL_ROOT);
  const documents = {};
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(directory, relative), {
      withFileTypes: true,
    })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (name !== "fixtures") visit(name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        documents[name] = fs.readFileSync(path.join(directory, name));
      }
    }
  };
  visit("");
  return documents;
}

function readBaselineDocuments(git) {
  return Object.fromEntries(
    git
      .baseFiles(PROTOCOL_ROOT)
      .map((file) => [protocolDocumentName(file), file])
      .filter(([name]) => name !== undefined)
      .map(([name, file]) => [name, git.readBase(file)]),
  );
}

function renamedProtocolDocuments(git) {
  const predecessors = {};
  for (const change of git.changedFiles([PROTOCOL_ROOT])) {
    if (!change.status.startsWith("R") || !change.path.endsWith(".md"))
      continue;
    const candidate = protocolDocumentName(change.path);
    const predecessor = protocolDocumentName(change.source);
    if (candidate && predecessor) predecessors[candidate] = predecessor;
  }
  return predecessors;
}

function protocolDocumentName(file) {
  const prefix = `${PROTOCOL_ROOT}/`;
  if (!file.startsWith(prefix) || !file.endsWith(".md")) return undefined;
  const relative = file.slice(prefix.length);
  return relative.startsWith("fixtures/") ? undefined : relative;
}

function bootstrapCap(source) {
  const lines = countPhysicalLines(source);
  return lines > STANDARD_LIMIT ? lines : undefined;
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
