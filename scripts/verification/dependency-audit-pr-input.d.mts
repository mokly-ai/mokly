import type { StrictAuditSummary } from "./dependency-audit.mjs";

/** Environment captured by the composition root; undefined values stay absent. */
export type PrEnvironment = Readonly<Record<string, string | undefined>>;

/** Complete arguments accepted by the update script. */
export interface PrArguments {
  outcome: "success" | "failure";
  log: string;
  report: string;
}

/** Validated repository metadata and REST authentication. */
export interface PrConfiguration {
  token: string;
  repository: string;
  owner: string;
  serverUrl: string;
  apiUrl: string;
  runUrl: string;
}

/** Captured artifacts and one UTC clock value, validated before any API call. */
export interface PrInputs {
  summary: StrictAuditSummary;
  log: string;
  now: Date;
}

/** Parse the complete CLI before starting file or network operations. */
export function parsePrArguments(args: readonly string[]): PrArguments;

/** Validate Actions metadata and the optional REST base, including enterprise URLs. */
export function prConfiguration(env: PrEnvironment): PrConfiguration;

/** Read both artifacts before any Git or GitHub call, including read-only calls. */
export function readPrInputs(
  options: PrArguments,
  readFile: (file: string) => Promise<string>,
  clock: () => Date,
): Promise<PrInputs>;
