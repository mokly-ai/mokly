import type { PackageReport } from "./archive.mjs";

/** One packed release archive, as the consumer smoke installs it. */
export interface ConsumerArchive {
  archivePath: string;
  report: Pick<PackageReport, "name" | "version">;
}

/** Run one command; the consumer smoke reads its standard output. */
export type ConsumerCommand = (
  file: string,
  args: string[],
  options: { cwd: string; env?: Readonly<Record<string, string>> },
) => Promise<{ stdout: string; stderr: string }>;

/** Install the host native package, the CLI, the viewer, and the UI package. */
export function installConsumer(
  root: string,
  packages: readonly ConsumerArchive[],
  execute?: ConsumerCommand,
): Promise<void>;

export function smokeAuthoring(
  root: string,
  execute?: ConsumerCommand,
): Promise<void>;

export function smokeBuild(
  root: string,
  version: string,
  execute?: ConsumerCommand,
): Promise<string>;
