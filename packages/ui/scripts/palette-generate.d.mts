import type { PaletteStylesheet } from "./palette-styles.mjs";

/** The mode and the file boundary of one generator run. */
export interface PaletteGeneratorRun {
  /** Compare the stylesheets with the committed files, and write nothing. */
  check: boolean;
  /** The formatted stylesheets, each with its repository path. */
  stylesheets: readonly PaletteStylesheet[];
  /** The committed text at a repository path, or undefined when it is missing. */
  read(path: string): Promise<string | undefined>;
  /** Write a stylesheet at its repository path. */
  write(path: string, css: string): Promise<void>;
  /** Print one line for the developer. */
  report(line: string): void;
}

/**
 * Write each stylesheet that differs from its committed file, or, in a check,
 * report each one that differs or is missing and write nothing. Resolves to
 * the exit status: 1 when a check finds a stale stylesheet, else 0.
 */
export function generatePaletteStylesheets(
  run: PaletteGeneratorRun,
): Promise<0 | 1>;
