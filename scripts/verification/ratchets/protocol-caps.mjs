import fs from "node:fs";
import path from "node:path";

import {
  countPhysicalLines,
  parseLegacyProtocolCaps,
  parseProtocolCapTable,
  allowedLines,
  PROTOCOL_LIMIT,
} from "./length-policy.mjs";

const CAP_TABLE = "xtask/protocol-document-caps.json";
const LEGACY_CAP_TEST = "tests/protocol_doc_sizes.test.ts";
const PROTOCOL_ROOT = "docs/protocol";
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
    if (
      cap === undefined &&
      current > allowedLines(`docs/protocol/${name}`, candidateCaps)
    ) {
      findings.push(
        `${name}: ${current} lines; documents above ${PROTOCOL_LIMIT} require an exact reviewed cap`,
      );
      continue;
    }
    if (cap === undefined) continue;
    if (current <= PROTOCOL_LIMIT) {
      findings.push(
        `${name}: ${current} lines; remove the cap at or below ${PROTOCOL_LIMIT}`,
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
  const candidateCaps = readCurrentCaps(repositoryRoot);
  const candidateDocuments = readCurrentDocuments(repositoryRoot);
  const baselineDocuments = readBaselineDocuments(git);
  const baselineCaps = readBaselineCaps(git);
  const predecessors = renamedProtocolDocuments(git);
  if (
    baselineCaps === undefined &&
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

function readCurrentCaps(repositoryRoot) {
  const file = path.join(repositoryRoot, CAP_TABLE);
  if (!fs.existsSync(file)) throw new Error(`${CAP_TABLE} is missing`);
  return parseProtocolCapTable(fs.readFileSync(file), CAP_TABLE);
}

/**
 * Read the comparison commit's caps: the JSON table, else the legacy test
 * table, else `undefined` so the audit bootstraps from baseline line counts.
 */
function readBaselineCaps(git) {
  if (git.baseFileExists(CAP_TABLE))
    return parseProtocolCapTable(
      git.readBase(CAP_TABLE),
      `${git.base}:${CAP_TABLE}`,
    );
  if (!git.baseFileExists(LEGACY_CAP_TEST)) return undefined;
  const label = `${git.base}:${LEGACY_CAP_TEST}`;
  const caps = parseLegacyProtocolCaps(git.readBase(LEGACY_CAP_TEST), label);
  if (!caps) throw new Error(`${label} has no oversizedCaps table`);
  return caps;
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
  return lines > PROTOCOL_LIMIT ? lines : undefined;
}
