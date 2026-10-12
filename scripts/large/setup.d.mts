import type { LargeSize } from "../../tests/fixtures/large/generate.js";
export interface PreparedLargeFixture {
  configPath: string;
  root: string;
  size: LargeSize;
  trackedOutput: boolean;
  routes: number;
  documents: number;
  templateDigest: string;
  moklyCommit: string;
  moklyDirty: boolean;
  fixtureCommit: string;
  renderingDependencies: Readonly<Record<string, string>>;
  preparedMoklyCommit?: string;
  preparedMoklyDirty?: boolean;
  preparedRenderingDependencies?: Readonly<Record<string, string>>;
}
export function prepareFixture(
  repository: string,
  size: LargeSize,
  debug: boolean,
  trackedOutput?: boolean,
): Promise<PreparedLargeFixture>;
export function preparedFixture(
  repository: string,
  size: LargeSize,
  trackedOutput?: boolean,
  configPath?: string,
): Promise<PreparedLargeFixture>;
