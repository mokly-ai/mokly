/** Forward the diagnostics and build warnings that a Serve child reports. */

import type { GenerationWarning } from "../build/warning_generation.js";

import {
  parseChildDiagnosticMessage,
  parseChildWarningMessage,
} from "./update_messages.js";

/** Send one child message to the diagnostic or warning listener that it names. */
export function forwardChildReport(
  message: unknown,
  onDiagnostic: ((message: string) => void) | undefined,
  onWarning: ((event: GenerationWarning) => void) | undefined,
): void {
  const diagnostic = parseChildDiagnosticMessage(message);
  if (diagnostic) onDiagnostic?.(diagnostic.message);
  const warning = parseChildWarningMessage(message);
  if (warning) onWarning?.(warning);
}
