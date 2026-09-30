import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { GitWorkspace } from "./ratchets/git.mjs";
import {
  auditInternalExports,
  internalExportAudit,
} from "./ratchets/internal-exports.mjs";
import { countPhysicalLines } from "./ratchets/lines.mjs";
import {
  auditProtocolCaps,
  protocolCapFindings,
} from "./ratchets/protocol-caps.mjs";
import { auditPublicPackageExports } from "./ratchets/public-exports.mjs";
import {
  auditTypeScriptLength,
  typeScriptLengthFindings,
} from "./ratchets/typescript-length.mjs";

export {
  countPhysicalLines,
  internalExportAudit,
  protocolCapFindings,
  typeScriptLengthFindings,
};

/** Run the release-tag public package export audit in isolation. */
export function publicPackageExportAudit(repositoryRoot) {
  return auditPublicPackageExports(
    repositoryRoot,
    new GitWorkspace(repositoryRoot),
  );
}

/** Run every maintainability ratchet without stopping after the first finding. */
export function runRepositoryRatchets(repositoryRoot) {
  const git = new GitWorkspace(repositoryRoot);
  git.requireBase();
  const audits = [
    [
      "JavaScript/TypeScript file-length",
      () => auditTypeScriptLength(repositoryRoot, git),
    ],
    ["Protocol document cap", () => auditProtocolCaps(repositoryRoot, git)],
    ["Unused internal export", () => auditInternalExports(repositoryRoot, git)],
    [
      "Public package export",
      () => auditPublicPackageExports(repositoryRoot, git),
    ],
  ];
  let failed = false;
  for (const [name, audit] of audits) {
    let result;
    try {
      result = audit();
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${name} ratchet could not run: ${message}`);
      continue;
    }
    if (result.findings.length === 0) {
      console.error(`${name} ratchet passed (${result.summary}).`);
      continue;
    }
    failed = true;
    console.error(`${name} ratchet failed:`);
    for (const finding of result.findings) console.error(`- ${finding}`);
  }
  return !failed;
}

function main() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  try {
    if (!runRepositoryRatchets(repositoryRoot)) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Repository ratchets could not run: ${message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main();
