import { auditCommandEnvironment } from "./dependency-audit-command.mjs";
import { auditCause } from "./dependency-audit-issues.mjs";

const BRANCH = "dependency-audit/main";
const REF = `refs/heads/${BRANCH}`;
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
const BOT_IDENTITY = [BOT_NAME, BOT_EMAIL, BOT_NAME, BOT_EMAIL];

function changedPaths(status) {
  const entries = status.split("\0");
  const paths = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    paths.push(entry.slice(3));
    if (/^[RC]|^.[RC]/u.test(entry)) paths.push(entries[++index]);
  }
  return paths;
}

/** Remove API tokens from every child and force both commit identities to the bot. */
function prChildEnvironment(env, cwd) {
  const clean = Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !/^(?:github_token|gh_token)$/iu.test(key),
    ),
  );
  return {
    ...auditCommandEnvironment(clean, cwd),
    GIT_AUTHOR_NAME: BOT_NAME,
    GIT_AUTHOR_EMAIL: BOT_EMAIL,
    GIT_COMMITTER_NAME: BOT_NAME,
    GIT_COMMITTER_EMAIL: BOT_EMAIL,
  };
}

/** Inspect actual remote history and write only with a lease on that inspected tip. */
export function createPrGit({ runCommand, cwd, env }) {
  const childEnv = prChildEnvironment(env, cwd);
  const execute = async (file, args) => {
    const operation = `${file} ${args.join(" ")}`;
    let result;
    try {
      result = await runCommand({
        file,
        args,
        cwd,
        shell: false,
        env: childEnv,
      });
    } catch (cause) {
      throw new Error(
        `Dependency update command ${operation} could not start. Fix Git or npm access and retry.`,
        { cause },
      );
    }
    if (result.exitCode !== 0 || result.signal)
      throw new Error(
        `Dependency update command ${operation} failed (exit ${result.exitCode}, signal ${result.signal ?? "none"}). Restore Git or npm access and retry. ${result.stderr || result.stdout}`,
      );
    return result.stdout;
  };
  const git = (args) => execute("git", args);
  return {
    async inspectBranch() {
      await git([
        "fetch",
        "origin",
        "+refs/heads/main:refs/remotes/origin/main",
      ]);
      const remote = await git(["ls-remote", "--heads", "origin", REF]);
      if (!remote.trim()) return { tip: null, botOnly: true };
      const tip = remote.trim().split(/\s+/u)[0];
      if (!/^[a-f0-9]{40,64}$/u.test(tip))
        throw new Error(
          `Cannot read ${BRANCH} remote tip. Fetch origin and retry.`,
        );
      await git(["fetch", "origin", tip]);
      const commits = (await git(["rev-list", `origin/main..${tip}`]))
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
      let botOnly = true;
      for (const commit of commits) {
        const identity = (
          await git(["log", "-1", "--format=%an%x00%ae%x00%cn%x00%ce", commit])
        )
          .replace(/\r?\n$/u, "")
          .split("\0");
        if (
          identity.length !== 4 ||
          !BOT_IDENTITY.every((field, index) => identity[index] === field)
        )
          botOnly = false;
      }
      return { tip, botOnly };
    },
    async updateBranch(packages, tip) {
      await git(["checkout", "-B", BRANCH, "origin/main"]);
      await execute("npm", ["ci", "--ignore-scripts"]);
      for (const name of packages)
        await execute("npm", ["update", name, "--ignore-scripts"]);
      const paths = changedPaths(
        await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
      );
      const manifest = paths.find(
        (file) => file === "package.json" || file?.endsWith("/package.json"),
      );
      if (manifest)
        throw new Error(
          `Dependency update changed ${manifest}. Restore package.json constraints and retry; no commit or push was made.`,
        );
      const lockChanged = paths.includes("package-lock.json");
      if (lockChanged) await git(["add", "--", "package-lock.json"]);
      await git([
        "-c",
        `user.name=${BOT_NAME}`,
        "-c",
        `user.email=${BOT_EMAIL}`,
        "commit",
        ...(lockChanged ? [] : ["--allow-empty"]),
        "-m",
        lockChanged
          ? "fix(deps): update audited dependencies"
          : "chore(deps): track dependency audit findings",
      ]);
      await git([
        "push",
        `--force-with-lease=${REF}:${tip ?? ""}`,
        "origin",
        `HEAD:${REF}`,
      ]);
    },
    async deleteBranch(tip) {
      await git([
        "push",
        `--force-with-lease=${REF}:${tip}`,
        "origin",
        `:${REF}`,
      ]);
    },
  };
}

/** Diagnostics keep the failing operation but never expose API tokens. */
export function prFailureMessage(error, env) {
  let message = auditCause(error);
  for (const token of [env.GITHUB_TOKEN, env.GH_TOKEN])
    if (token) message = message.replaceAll(token, "[redacted]");
  return message;
}
