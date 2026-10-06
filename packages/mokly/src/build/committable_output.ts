import path from "node:path";

import { projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { NodeGitCommandRunner, type GitCommandRunner } from "../review/git.js";
import { GitProcessError } from "../review/git_process.js";

interface IgnoreMatch {
  readonly source: string;
  readonly line: string;
  readonly pattern: string;
  readonly pathname: string;
}

/** Ensure committed generated routes are not hidden by effective Git ignores. */
export async function assertCommittableOutput(
  routes: Iterable<string>,
  config: ResolvedConfig,
  runner: GitCommandRunner = new NodeGitCommandRunner(config.repoRoot),
): Promise<void> {
  if (config.generatedOutput !== "committed" || !runner.runBytesWithInput)
    return;
  let topLevel: string;
  try {
    topLevel = (await runner.run(["rev-parse", "--show-toplevel"])).trim();
    if (projectRealPath(topLevel) !== projectRealPath(config.repoRoot)) return;
  } catch {
    return;
  }
  const mockups = toPosixPath(
    path.relative(config.repoRoot, config.mockupsDir),
  );
  const segments = mockups.split("/").filter(Boolean);
  const ancestors = segments.map((_, index) =>
    segments.slice(0, index + 1).join("/"),
  );
  const routePaths = [...routes].map((route) => ({
    route,
    pathname: `${mockups ? `${mockups}/` : ""}${route}`,
  }));
  const paths = [
    ...new Set([...ancestors, ...routePaths.map((entry) => entry.pathname)]),
  ];
  let output: Uint8Array;
  try {
    output = await runner.runBytesWithInput(
      ["check-ignore", "-v", "-z", "--stdin"],
      Buffer.from(`${paths.join("\0")}\0`),
    );
  } catch (error) {
    if (error instanceof GitProcessError && error.exitCode === 1) return;
    throw error;
  }
  const matches = parseMatches(output);
  const ignored = new Map(
    matches
      .filter((match) => !match.pattern.startsWith("!"))
      .map((match) => [match.pathname, match]),
  );
  const ignoredAncestor = ancestors
    .map((name) => ignored.get(name))
    .find(Boolean);
  if (ignoredAncestor)
    throw new MoklyError(
      "build-invalid",
      `mockups directory is ignored by Git: ${rule(ignoredAncestor)}; remove that rule or use generatedOutput: "derived"`,
    );
  const ignoredRoutes = routePaths
    .map((entry) => ({ ...entry, match: ignored.get(entry.pathname) }))
    .filter(
      (entry): entry is typeof entry & { match: IgnoreMatch } =>
        entry.match !== undefined,
    )
    .sort((left, right) =>
      left.route < right.route ? -1 : left.route > right.route ? 1 : 0,
    );
  if (!ignoredRoutes.length) return;
  const listed = ignoredRoutes.slice(0, 8);
  const overflow = ignoredRoutes.length - listed.length;
  const suggestions = new Map<string, Set<string>>();
  for (const entry of ignoredRoutes) {
    const source = entry.match.source.endsWith(".gitignore")
      ? entry.match.source
      : ".gitignore";
    const sourceDirectory = path.posix.dirname(source);
    const relative = path.posix.relative(
      sourceDirectory === "." ? "" : sourceDirectory,
      entry.pathname,
    );
    const reserved = entry.route.startsWith("mokly-generated/");
    const suggestion = reserved
      ? `!/${path.posix.relative(sourceDirectory === "." ? "" : sourceDirectory, `${mockups ? `${mockups}/` : ""}mokly-generated`)}/**`
      : `!/${relative}`;
    const lines = suggestions.get(source) ?? new Set<string>();
    lines.add(suggestion);
    suggestions.set(source, lines);
  }
  const guidance = [...suggestions]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(
      ([source, lines]) =>
        `Add to ${source}:\n${[...lines]
          .sort()
          .map((line) => `  ${line}`)
          .join("\n")}`,
    )
    .join("\n");
  throw new MoklyError(
    "build-invalid",
    `generated files are ignored by Git:\n${listed.map((entry) => `  - ${entry.route} (${rule(entry.match)})`).join("\n")}${overflow ? `\n  ... and ${overflow} more` : ""}\n${guidance}`,
  );
}

function rule(match: IgnoreMatch): string {
  return `${match.source}:${match.line} ${match.pattern}`;
}

function parseMatches(bytes: Uint8Array): IgnoreMatch[] {
  const fields = Buffer.from(bytes).toString("utf8").split("\0");
  const matches: IgnoreMatch[] = [];
  for (let index = 0; index + 3 < fields.length; index += 4)
    matches.push({
      source: fields[index]!,
      line: fields[index + 1]!,
      pattern: fields[index + 2]!,
      pathname: fields[index + 3]!,
    });
  return matches;
}
