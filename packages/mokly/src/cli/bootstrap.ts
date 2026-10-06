/** Node releases exercised by every package, unit, and browser CI lane. */
export const TESTED_NODE_VERSIONS = ["22.14.0", "24.21.0"] as const;

type NodeVersion = readonly [major: number, minor: number, patch: number];

const MINIMUM_NODE_VERSION = [22, 14, 0] as const satisfies NodeVersion;
const FIRST_AFFECTED_NODE_VERSION = [24, 14, 0] as const satisfies NodeVersion;
const FIRST_FIXED_NODE_VERSION = [24, 19, 0] as const satisfies NodeVersion;

/** npm engine range shared by package metadata and the CLI preflight. */
export const SUPPORTED_NODE_RANGE = `>=${formatVersion(MINIMUM_NODE_VERSION)} <${formatVersion(FIRST_AFFECTED_NODE_VERSION)} || >=${formatVersion(FIRST_FIXED_NODE_VERSION)}`;

interface CliBootstrapOptions {
  load: () => Promise<void>;
  nodeVersion: string;
  reportUnsupported: (message: string) => void;
}

/** Return whether a stable Node release satisfies Mokly's supported range. */
export function isSupportedNodeVersion(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) return false;
  const parsed = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ] as const satisfies NodeVersion;
  return (
    (compareVersions(parsed, MINIMUM_NODE_VERSION) >= 0 &&
      compareVersions(parsed, FIRST_AFFECTED_NODE_VERSION) < 0) ||
    compareVersions(parsed, FIRST_FIXED_NODE_VERSION) >= 0
  );
}

/** Validate Node before loading the CLI's application module graph. */
export async function bootstrapCli({
  load,
  nodeVersion,
  reportUnsupported,
}: CliBootstrapOptions): Promise<void> {
  if (!isSupportedNodeVersion(nodeVersion)) {
    reportUnsupported(
      `Node.js ${SUPPORTED_NODE_RANGE} is required; Node 24.14.0 through 24.18.x is unsupported; found ${nodeVersion}`,
    );
    return;
  }
  await load();
}

function formatVersion(version: NodeVersion): string {
  return version.join(".");
}

function compareVersions(left: NodeVersion, right: NodeVersion): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}
