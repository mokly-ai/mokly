import { runCommand } from "./command.mjs";
import { validateTagVersion } from "./context.mjs";

const [base] = process.argv.slice(2);
if (process.argv.length !== 3 || !/^[a-f0-9]{40}$/.test(base ?? ""))
  throw new Error("Supply the release pull request's full base commit SHA.");

/** @param {string[]} args */
const git = async (...args) =>
  (await runCommand("git", args, { cwd: process.cwd() })).stdout.trim();
const head = await git("rev-parse", "HEAD");
const [baseCli, baseViewer, cli, viewer] = await Promise.all([
  versionAt(base, "mokly"),
  versionAt(base, "viewer"),
  versionAt(head, "mokly"),
  versionAt(head, "viewer"),
]);

if (viewer !== baseViewer && cli === baseCli)
  throw new Error(
    "Release the CLI with the viewer before merging this release pull request.",
  );

if (viewer === baseViewer) {
  const tag = `viewer-v${viewer}`;
  let tagged;
  try {
    tagged = await git("rev-parse", "--verify", `refs/tags/${tag}^{commit}`);
  } catch (cause) {
    throw new Error(
      `Cannot verify ${tag}. Fetch the viewer release tag and retry.`,
      { cause },
    );
  }
  const changed = await git(
    "diff",
    "--no-renames",
    "--name-only",
    "-z",
    tagged,
    head,
    "--",
    "packages/viewer",
    ":(exclude)packages/viewer/tests",
  );
  if (changed)
    throw new Error(
      `Viewer source changed since ${tag}. Release the viewer with the CLI before merging this release pull request.`,
    );
}

process.stdout.write(
  "Release pull request passed the viewer source and component checks.\n",
);

/**
 * @param {string} commit
 * @param {"mokly" | "viewer"} name
 * @returns {Promise<string>}
 */
async function versionAt(commit, name) {
  /** @type {unknown} */
  const value = JSON.parse(
    await git("show", `${commit}:packages/${name}/package.json`),
  );
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "string"
  )
    throw new Error(
      `Cannot read the ${name} version at ${commit}. Restore its package manifest and retry.`,
    );
  validateTagVersion(`v${value.version}`, value.version);
  return value.version;
}
