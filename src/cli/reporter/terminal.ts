import { styleText } from "node:util";

import type { CliOutput, TerminalEnvironment } from "./types.js";

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Reporter symbols selected for the capabilities of this terminal. */
export interface TerminalGlyphs {
  readonly box: {
    readonly bottomLeft: string;
    readonly bottomRight: string;
    readonly horizontal: string;
    readonly topLeft: string;
    readonly topRight: string;
    readonly vertical: string;
  };
  readonly evidence: string;
  readonly failure: string;
  readonly reload: string;
  readonly restart: string;
  readonly rebuild: string;
  readonly spinner: readonly string[];
  readonly success: string;
  readonly warning: string;
}

/** Select Unicode or conservative ASCII presentation without probing the terminal. */
export function terminalGlyphs(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): TerminalGlyphs {
  const ascii =
    platform === "win32" && !env.WT_SESSION && !env.TERM_PROGRAM && !env.TERM;
  return ascii
    ? {
        box: {
          bottomLeft: "+",
          bottomRight: "+",
          horizontal: "-",
          topLeft: "+",
          topRight: "+",
          vertical: "|",
        },
        evidence: "G",
        failure: "x",
        rebuild: "R",
        reload: "L",
        restart: "S",
        spinner: ["|", "/", "-", "\\"],
        success: "+",
        warning: "!",
      }
    : {
        box: {
          bottomLeft: "└",
          bottomRight: "┘",
          horizontal: "─",
          topLeft: "┌",
          topRight: "┐",
          vertical: "│",
        },
        evidence: "⟲",
        failure: "✖",
        rebuild: "↻",
        reload: "⟳",
        restart: "↺",
        spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
        success: "✔",
        warning: "!",
      };
}

/** Format elapsed terminal time without suggesting false precision. */
export function formatDuration(milliseconds: number): string {
  const safe = Math.max(0, milliseconds);
  if (safe < 1_000) return `${Math.round(safe)}ms`;
  if (safe < 60_000) return `${(safe / 1_000).toFixed(1)}s`;
  const totalSeconds = Math.round(safe / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
}

/** Bound one rendered line and avoid retaining incomplete ANSI sequences. */
export function truncateTerminalLine(value: string, columns: number): string {
  const width = Number.isSafeInteger(columns) && columns > 0 ? columns : 80;
  const visible = value.replace(ANSI_PATTERN, "");
  if (visible.length <= width) return value;
  if (width === 1) return "…";
  return `${visible.slice(0, width - 1)}…`;
}

/** Resolve the bounded width for either terminal stream. */
export function terminalWidth(
  output: CliOutput,
  env: NodeJS.ProcessEnv = {},
): number {
  if (Number.isSafeInteger(output.columns) && (output.columns ?? 0) > 0)
    return output.columns!;
  const configured = Number(env.COLUMNS);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 80;
}

/** Apply a Node terminal style while honoring the injected no-colour contract. */
export function terminalStyle(
  environment: TerminalEnvironment,
  output: CliOutput,
  format: Parameters<typeof styleText>[0],
  value: string,
): string {
  if (environment.env.NO_COLOR !== undefined) return value;
  if (!output.isTTY && environment.env.FORCE_COLOR === undefined) return value;
  return styleText(format, value, {
    stream: output as unknown as NodeJS.WritableStream,
    validateStream: true,
  });
}
