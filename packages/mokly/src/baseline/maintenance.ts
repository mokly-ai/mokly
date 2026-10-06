/** Maintenance diagnostics cannot change a successful or failed build outcome. */
import { errorMessage } from "../errors.js";

export interface BaselineMaintenanceFailure {
  readonly entry: string;
  readonly error: unknown;
}

/** Report a post-step failure without throwing or replacing the build's outcome. */
export interface BaselineMaintenanceReporter {
  report(failure: BaselineMaintenanceFailure): void;
}

export class StderrBaselineMaintenanceReporter implements BaselineMaintenanceReporter {
  constructor(
    private readonly write: (line: string) => void = (line) => {
      process.stderr.write(line);
    },
  ) {}

  report(failure: BaselineMaintenanceFailure): void {
    try {
      this.write(
        `[mokly/baseline-cleanup] ${failure.entry}: ${errorMessage(failure.error)}\n`,
      );
    } catch {
      // A closed diagnostic stream cannot replace the build's outcome.
    }
  }
}
