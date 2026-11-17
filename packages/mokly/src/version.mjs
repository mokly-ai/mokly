/** The declared Node support range and the local verification representatives. */
export const SUPPORTED_NODE_RANGE =
  ">=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0";
export const TESTED_NODE_VERSIONS = ["22.15.0", "24.21.0"];

/**
 * The published npm `engines` range. npm installs the newest release whose
 * `engines` accept the running Node, so a narrower range here would install an
 * older Mokly silently. 22.14.0 is the lowest floor of any published release,
 * so no earlier release accepts a Node that this range rejects. The shim
 * rejects every unsupported version at startup, with a message that names the
 * fix.
 */
export const NODE_ENGINE_RANGE = ">=22.14.0";

/** Enforce the supported Node range before resolving a native binary. */
export function assertNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor] = match ? match.slice(1).map(Number) : [];
  const crashing = major === 24 && minor >= 14 && minor < 19;
  if (
    !match ||
    major < 22 ||
    major === 23 ||
    (major === 22 && minor < 15) ||
    crashing
  ) {
    const reason = crashing
      ? " A Node.js bug in 24.14 through 24.18 can crash Mokly."
      : "";
    throw new Error(
      `Mokly requires Node.js ${SUPPORTED_NODE_RANGE}; found ${version}.${reason} Install Node.js 24.19 or later, then run mokly again.`,
    );
  }
}

/** Require the same coordinated version in the shim and platform package. */
export function assertNativeVersion(expected, actual, name) {
  if (actual !== expected) {
    throw new Error(
      `${name} version ${actual} does not match @mokly/mokly ${expected}. Reinstall @mokly/mokly with optional dependencies enabled.`,
    );
  }
}
