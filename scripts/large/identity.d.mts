import type { LargeSize } from "../../tests/fixtures/large/generate.js";
export const identityFilename: string;
export const renderingDependencyNames: readonly string[];
export function renderingDependencies(
  repository: string,
  fixtureRoot?: string,
): Promise<Readonly<Record<string, string>>>;
export interface FixtureIdentity extends LargeSize {
  schemaVersion: 1;
  templateDigest: string;
  moklyCommit: string;
  moklyDirty: boolean;
  fixtureCommit: string;
  generatedOutput: "committed" | "derived";
  renderingDependencies: Readonly<Record<string, string>>;
}
export function templateDigest(directory: string): Promise<string>;
export function moklyIdentity(
  repository: string,
): Promise<{ moklyCommit: string; moklyDirty: boolean }>;
export function preparationCommand(
  size: LargeSize,
  generatedOutput?: "committed" | "derived",
): string;
export function readFixtureIdentity(
  repository: string,
  root: string,
  size: LargeSize,
  mode?: "committed" | "derived",
): Promise<FixtureIdentity>;
