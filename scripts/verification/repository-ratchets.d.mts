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

export function countPhysicalLines(value: string | Buffer): number;
export function typeScriptLengthFindings(
  changes: readonly TypeScriptLengthInput[],
): string[];
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
export function publicPackageExportAudit(repositoryRoot: string): {
  findings: string[];
  summary: string;
};
export function runRepositoryRatchets(repositoryRoot: string): boolean;
