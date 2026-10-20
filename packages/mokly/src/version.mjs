/** The declared Node support range and the local verification representatives. */
export const SUPPORTED_NODE_RANGE = ">=22.15.0 <24.14.0 || >=24.19.0";
export const TESTED_NODE_VERSIONS = ["22.15.0", "24.21.0"];

/** Enforce the package's Node engine range before resolving a native binary. */
export function assertNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor] = match ? match.slice(1).map(Number) : [];
  if (
    !match ||
    major < 22 ||
    (major === 22 && minor < 15) ||
    (major === 24 && minor >= 14 && minor < 19)
  ) {
    throw new Error(
      `Mokly requires Node.js >=22.15.0 <24.14.0 or >=24.19.0; found ${version}. Install a supported Node.js version and run mokly again.`,
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
