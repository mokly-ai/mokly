import type { LargeSize } from "../../tests/fixtures/large/generate.js";
export interface PreparedLargeFixture {
  configPath: string;
  root: string;
  size: LargeSize;
  generatedOutput: "committed" | "derived";
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
  mode?: "committed" | "derived",
): Promise<PreparedLargeFixture>;
export function preparedFixture(
  repository: string,
  size: LargeSize,
  mode?: "committed" | "derived",
  configPath?: string,
): Promise<PreparedLargeFixture>;
