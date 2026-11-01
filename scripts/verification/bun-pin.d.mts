/** File access for the repository's exact Bun version pin. */
export interface BunPinOptions {
  readFile?: (file: string) => Promise<string>;
}

/** A usable pin or the reason the pin cannot select a compiler. */
export type BunPin =
  { status: "valid"; version: string } | { status: "invalid"; reason: string };

/** Read one exact version from .bun-version without installing any tools. */
export function readBunPin(
  root: string,
  options?: BunPinOptions,
): Promise<BunPin>;
