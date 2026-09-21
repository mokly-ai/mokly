/** Painted palette pairs and the contrast criterion each one carries. */

/** Null records a decorative or disabled pair with no contrast minimum. */
export type PalettePair = readonly [
  label: string,
  foreground: string,
  background: string,
  minimum: number | null,
];

/** Every accessibility-bearing, status, and fixed-device pair in the shell. */
export const PALETTE_PAIRS: readonly PalettePair[] = [
  ["ink on surface", "--chrome-ink", "--chrome-surface", 4.5],
  ["ink on background", "--chrome-ink", "--chrome-bg", 4.5],
  ["secondary ink on surface", "--chrome-ink-2", "--chrome-surface", 4.5],
  ["muted on surface", "--chrome-muted", "--chrome-surface", 4.5],
  ["muted on background", "--chrome-muted", "--chrome-bg", 4.5],
  ["muted on raised", "--chrome-muted", "--chrome-raised", 4.5],
  ["muted on hover", "--chrome-muted", "--chrome-hover", 4.5],
  ["accent link on surface", "--chrome-accent", "--chrome-surface", 4.5],
  ["accent on surface", "--mokly-accent", "--chrome-surface", 4.5],
  ["deep accent on surface", "--mbk-accent-deep", "--chrome-surface", 4.5],
  [
    "deep accent on accent surface",
    "--mbk-accent-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  [
    "accent contrast on accent",
    "--mokly-accent-contrast",
    "--mokly-accent",
    4.5,
  ],
  [
    "changed ink on its surface",
    "--mbk-status-changed-ink",
    "--mbk-status-changed-bg",
    4.5,
  ],
  [
    "removed ink on its surface",
    "--mbk-status-removed-ink",
    "--mbk-status-removed-bg",
    4.5,
  ],
  ["validation ink on its surface", "--mbk-danger-ink", "--mbk-danger-bg", 4.5],
  ["control edge on surface", "--chrome-control-edge", "--chrome-surface", 3],
  ["control edge on background", "--chrome-control-edge", "--chrome-bg", 3],
  ["control edge on raised", "--chrome-control-edge", "--chrome-raised", 3],
  ["focus outline on background", "--mbk-accent-deep", "--chrome-bg", 3],
  [
    "state boundary on accent surface",
    "--mbk-accent-deep",
    "--mbk-accent-surface",
    3,
  ],
  [
    "added ink on its surface",
    "--mbk-accent-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  [
    "added edge on its surface",
    "--mbk-accent-edge",
    "--mbk-accent-surface",
    null,
  ],
  [
    "changed edge on its surface",
    "--mbk-status-changed-edge",
    "--mbk-status-changed-bg",
    null,
  ],
  [
    "removed edge on its surface",
    "--mbk-status-removed-edge",
    "--mbk-status-removed-bg",
    null,
  ],
  [
    "validation edge on its surface",
    "--mbk-danger-edge",
    "--mbk-danger-bg",
    null,
  ],
  [
    "validation message on surface",
    "--mbk-danger-ink",
    "--chrome-surface",
    4.5,
  ],
  [
    "disabled ink on its surface",
    "--chrome-disabled-ink",
    "--chrome-disabled-bg",
    null,
  ],
  [
    "dark screen ink on its surface",
    "--mbk-dark-screen-ink",
    "--mbk-dark-screen-bg",
    4.5,
  ],
  [
    "device body around a light screen",
    "--mbk-device-body",
    "--mbk-screen-bg",
    3,
  ],
  [
    "device notch on a light screen",
    "--mbk-device-notch",
    "--mbk-screen-bg",
    3,
  ],
  [
    "device home indicator on a light screen",
    "--mbk-device-home",
    "--mbk-screen-bg",
    null,
  ],
  [
    "close light on the browser bar",
    "--mbk-device-light-close",
    "--mbk-browser-bar",
    null,
  ],
  [
    "minimise light on the browser bar",
    "--mbk-device-light-minimise",
    "--mbk-browser-bar",
    null,
  ],
  [
    "expand light on the browser bar",
    "--mbk-device-light-expand",
    "--mbk-browser-bar",
    null,
  ],
];
