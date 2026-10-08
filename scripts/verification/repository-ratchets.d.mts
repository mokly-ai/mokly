export interface TypeScriptLengthInput {
  path: string;
  current: string | Buffer;
  predecessorPath?: string;
  previous?: string | Buffer;
}

export interface InternalExportModule {
  path: string;
  source: string;
  candidate?: boolean;
}

/** One export candidate policy, baseline, and diagnostic vocabulary. */
export interface ExportScope {
  id: "internal" | "testHelpers";
  roots: readonly string[];
  baseline: string;
  label: string;
  moduleLabel: string;
  baselinePattern: RegExp;
  excludes(file: string): boolean;
}

/** Candidate count and unused keys from the shared graph. */
export interface ExportScopeDiscovery {
  moduleCount: number;
  unused: string[];
}

export const TEST_HELPER_EXPORT_SCOPE: ExportScope;
export function analyzeExportScopes(input: {
  modules: readonly { path: string; source: string }[];
  publicEntrypoints: readonly string[];
  aliases?: Readonly<Record<string, string>>;
}): { internal: ExportScopeDiscovery; testHelpers: ExportScopeDiscovery };
export function exportScopeAudit(
  input: {
    unused: readonly string[];
    baseline: readonly string[];
    baselineAtComparison?: readonly string[];
  },
  scope: ExportScope,
): { findings: string[]; unused: readonly string[] };

export function countPhysicalLines(value: string | Buffer): number;
export function typeScriptLengthFindings(
  changes: readonly TypeScriptLengthInput[],
): string[];
export function parseProtocolCapTable(
  source: string | Buffer,
  label: string,
): Record<string, number>;
export function protocolCapFindings(input: {
  candidateDocuments: Readonly<Record<string, string | Buffer>>;
  candidateCaps: Readonly<Record<string, number>>;
  baselineDocuments: Readonly<Record<string, string | Buffer>>;
  baselineCaps?: Readonly<Record<string, number>>;
  predecessors?: Readonly<Record<string, string>>;
}): string[];
export function internalExportAudit(input: {
  modules: readonly InternalExportModule[];
  publicEntrypoints: readonly string[];
  baseline: readonly string[];
  baselineAtComparison?: readonly string[];
  aliases?: Readonly<Record<string, string>>;
}): { findings: string[]; unused: string[] };
export function protocolCapAudit(repositoryRoot: string): {
  findings: string[];
  summary: string;
};
export function publicPackageExportAudit(repositoryRoot: string): {
  findings: string[];
  summary: string;
};
export function runRepositoryRatchets(repositoryRoot: string): boolean;
