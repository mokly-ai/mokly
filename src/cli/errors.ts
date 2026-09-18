import { errorMessage, MoklyError, type MoklyErrorCode } from "../errors.js";

/** Human-facing CLI failure while retaining the typed secondary code. */
export interface CliErrorPresentation {
  readonly code: MoklyErrorCode | undefined;
  readonly detail: string | undefined;
  readonly headline: string;
  readonly hint: string;
}

interface ErrorCopy {
  readonly headline: string;
  readonly hint: string;
}

const ERROR_COPY: Readonly<Record<MoklyErrorCode, ErrorCopy>> = {
  "baseline-history-unavailable": {
    headline: "Comparison history is unavailable.",
    hint: "Fetch the configured base and retry.",
  },
  "baseline-extraction-failed": {
    headline: "The comparison baseline could not be prepared.",
    hint: "Check the Git object and temporary storage.",
  },
  "baseline-command-failed": {
    headline: "The comparison baseline build failed.",
    hint: "Run the configured baseline command locally.",
  },
  "baseline-output-invalid": {
    headline: "The comparison baseline output is invalid.",
    hint: "Build the baseline and fix its generated output.",
  },
  "baseline-interrupted": {
    headline: "Comparison preparation was interrupted.",
    hint: "Retry when the repository is idle.",
  },
  "baseline-lock-timeout": {
    headline: "The comparison baseline is busy.",
    hint: "Stop the other Mokly process or retry later.",
  },
  "build-invalid": {
    headline: "The catalogue could not be built.",
    hint: "Fix the reported catalogue source and retry.",
  },
  "cli-invalid": {
    headline: "The command could not be understood.",
    hint: "Run mokly --help to see commands.",
  },
  "config-invalid": {
    headline: "The Mokly configuration is invalid.",
    hint: "Fix the reported configuration value and retry.",
  },
  "config-missing": {
    headline: "No Mokly configuration was found.",
    hint: "Run inside a consumer repository or pass --config.",
  },
  "export-invalid": {
    headline: "The catalogue could not be exported.",
    hint: "Fix the reported destination or input and retry.",
  },
  "git-failed": {
    headline: "Git information could not be read.",
    hint: "Check the repository and configured base.",
  },
  "manifest-invalid": {
    headline: "The generated catalogue is invalid.",
    hint: "Rebuild the catalogue and fix the reported entry.",
  },
  "review-invalid": {
    headline: "The comparison could not be created.",
    hint: "Fix the reported comparison input and retry.",
  },
  "server-failed": {
    headline: "The catalogue server could not start.",
    hint: "Check the reported port or process and retry.",
  },
  "upload-failed": {
    headline: "The catalogue could not be published.",
    hint: "Check the endpoint and connection, then retry.",
  },
  "upload-invalid-bundle": {
    headline: "The catalogue upload is invalid.",
    hint: "Rebuild the export and retry.",
  },
  "upload-too-large": {
    headline: "The catalogue is too large to publish.",
    hint: "Reduce the export size or raise the receiver limit.",
  },
  "upload-unauthorized": {
    headline: "The catalogue upload was not authorized.",
    hint: "Check the token and repository access.",
  },
  "upload-unsupported-version": {
    headline: "The receiver does not support this catalogue.",
    hint: "Upgrade the receiver or use a supported Mokly version.",
  },
};

const PUBLIC_COMMANDS = ["serve", "build", "check", "export", "publish"];

/** Translate a typed failure only at the rich CLI presentation boundary. */
export function cliErrorPresentation(error: unknown): CliErrorPresentation {
  if (!(error instanceof MoklyError)) {
    return {
      code: undefined,
      detail: errorMessage(error),
      headline: "Mokly could not complete the command.",
      hint: "Retry, or set MOKLY_DIAGNOSTIC=1 for diagnostic details.",
    };
  }
  const detail = stripErrorPrefix(error);
  if (error.code === "cli-invalid") {
    const command = /^unknown command: (.+)$/.exec(detail)?.[1];
    if (command) {
      const closest = closestCommand(command);
      return {
        code: error.code,
        detail: undefined,
        headline: `Unknown command "${command}".`,
        hint: closest
          ? `Did you mean "${closest}"? Run mokly --help to see commands.`
          : "Run mokly --help to see commands.",
      };
    }
    const option = /^unknown option: (.+)$/.exec(detail)?.[1];
    if (option)
      return {
        code: error.code,
        detail: undefined,
        headline: `Unknown option "${option}".`,
        hint: "Run mokly --help to see supported options.",
      };
  }
  return { code: error.code, detail, ...ERROR_COPY[error.code] };
}

function stripErrorPrefix(error: MoklyError): string {
  const prefix = `[mokly/${error.code}] `;
  return error.message.startsWith(prefix)
    ? error.message.slice(prefix.length)
    : error.message;
}

function closestCommand(candidate: string): string | undefined {
  const ranked = PUBLIC_COMMANDS.map((command) => ({
    command,
    distance: editDistance(candidate, command),
  })).sort((left, right) => left.distance - right.distance);
  const first = ranked[0];
  if (!first || first.distance > Math.max(2, Math.floor(candidate.length / 3)))
    return;
  return ranked[1]?.distance === first.distance ? undefined : first.command;
}

function editDistance(left: string, right: string): number {
  let previous = [...Array(right.length + 1).keys()];
  for (const [leftIndex, leftCharacter] of [...left].entries()) {
    const current = [leftIndex + 1];
    for (const [rightIndex, rightCharacter] of [...right].entries()) {
      current.push(
        Math.min(
          (current[rightIndex] ?? 0) + 1,
          (previous[rightIndex + 1] ?? 0) + 1,
          (previous[rightIndex] ?? 0) +
            (leftCharacter === rightCharacter ? 0 : 1),
        ),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? right.length;
}
