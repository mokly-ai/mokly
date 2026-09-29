/**
 * How one artboard depicts watched Serve's status for the latest saved
 * changes. Only the rebuild status screens supply one; every other artboard
 * draws the shell without a notice or progress.
 */
export interface RebuildDepiction {
  /** The failure notice with its details collapsed or open; absent once loaded. */
  failure?: "collapsed" | "open" | undefined;
  /** Delayed progress is showing in the top bar. */
  updating?: boolean | undefined;
}

/**
 * The one sanitized, repository-relative diagnostic the notice discloses: the
 * failed rebuild's message with its line breaks, well inside the character
 * and byte bounds, and one import path long enough to wrap at narrow widths.
 */
export const REBUILD_DETAIL = [
  "[mokly/build-invalid] could not bundle consumer modules: Build failed with 2 errors:",
  'components/Toolbar.tsx:12:24: ERROR: Could not resolve "../design-system/overflow/toolbar-overflow-menu.js"',
  'entries/catalogue.mockup.tsx:41:30: ERROR: Unexpected closing "h2" tag does not match opening "h1" tag',
].join("\n");
