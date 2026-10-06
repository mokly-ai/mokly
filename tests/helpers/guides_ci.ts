import { readFileSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";
import { GUIDES } from "./guides.js";

/** Read one repository file relative to the repository root. */
export const read = (...parts: string[]) =>
  readFileSync(path.join(repositoryRoot, ...parts), "utf8");
export const protocol = read("docs/protocol/mokly-upload.md").replace(
  /\s+/gu,
  " ",
);
export const exchange = [
  read("docs/protocol/mokly-upload-exchange.md"),
  read("docs/protocol/mokly-upload-validation.md"),
]
  .join("\n")
  .replace(/\s+/gu, " ");
export const recovery = read("docs/protocol/mokly-export-recovery.md").replace(
  /\s+/gu,
  " ",
);
export const terminal = [
  read("docs/protocol/mokly-terminal-output.md"),
  read("docs/protocol/mokly-terminal-errors.md"),
]
  .join("\n")
  .replace(/\s+/gu, " ");
export const verification = [
  read("docs/protocol/ci-verification.md"),
  read("docs/protocol/ci-suite-evidence.md"),
]
  .join("\n")
  .replace(/\s+/gu, " ");
export const workflow = read("docs/protocol/ci-workflow.md").replace(
  /\s+/gu,
  " ",
);
export const release = read("docs/protocol/npm-release.md").replace(
  /\s+/gu,
  " ",
);
export const sources = new Map(
  GUIDES.filter((page) => page.frontmatter.section === "ci").map((page) => [
    page.id,
    page.source,
  ]),
);
export const upload = sources.get("ci/the-upload") ?? "";
export const prose = upload.replace(/\s+/gu, " ");
export const manifest = {
  schemaVersion: 1,
  moklyVersion: "1.0.0",
  repository: { host: "example.com", owner: "team", name: "project" },
  branch: "main",
  headSha: "a".repeat(40),
  baseRef: null,
  baseSha: null,
  pullRequest: null,
  configPath: "mokly.config.ts",
  exportedAt: "2026-09-16T00:00:00.000Z",
  comparisonPath: null,
};
