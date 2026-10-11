import type { PrConfiguration } from "./dependency-audit-pr-input.mjs";

/** Evidence and validated metadata used to render the complete pull request body. */
export interface PrBodyInputs {
  log: string;
  now: Date;
  configuration: PrConfiguration;
}

/** Retain the latest evidence with safe fences and a UTF-16 body size bound. */
export function renderPrBody(inputs: PrBodyInputs): string;
