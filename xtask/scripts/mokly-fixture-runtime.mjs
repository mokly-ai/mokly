// Fixed Git identity and isolated CLI process state for fixture generation.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";

export const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const json = async (path) => JSON.parse(await readFile(path, "utf8"));

export async function fixtureRuntime(root, temporary) {
  const scratch = join(temporary, "runtime");
  const cache = join(scratch, "cache");
  const temp = join(scratch, "tmp");
  await mkdir(cache, { recursive: true });
  await mkdir(temp, { recursive: true });
  // An allowlist excludes caller Git overrides, CI pull-request identity,
  // Node preloads, Mokly credentials, locale and cache settings.
  const env = {
    PATH: process.env.PATH,
    ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    TMPDIR: temp,
    TMP: temp,
    TEMP: temp,
    XDG_CACHE_HOME: cache,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    TZ: "UTC",
    LC_ALL: "C",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Mokly fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Mokly fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
  };
  const cli = join(root, "packages/mokly/bin/mokly.mjs");
  function verifyCache(stdout) {
    for (const [, path] of stdout.matchAll(/^Mokly cache: (.+)$/gm)) {
      assertInside(cache, path);
    }
  }
  function run(program, args, cwd) {
    const result = spawnSync(program, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    verifyCache(result.stdout ?? "");
    if (result.error || result.status !== 0) {
      throw new Error(
        `${program} ${args.join(" ")} failed: ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
      );
    }
    return result.stdout.trim();
  }
  async function publish(cwd, endpoint, token, comparison = true) {
    const result = await command(
      cli,
      [
        "publish",
        "--strict",
        "--config",
        "mokly.config.json",
        "--repository",
        "github.com/mokly-ai/mokly-cloud",
        ...(comparison ? ["--base", "HEAD~1"] : ["--no-changes"]),
      ],
      cwd,
      { ...env, MOKLY_ENDPOINT: endpoint, MOKLY_TOKEN: token },
    );
    const builds = [...result.stdout.matchAll(/^Mokly publish build: (.+)$/gm)];
    try {
      verifyCache(result.stdout);
      assert(builds.length <= 1, "Expected at most one private publish build");
      for (const [, output] of builds) assertInside(temp, dirname(output));
    } finally {
      for (const [, output] of builds) {
        assertInside(temp, dirname(output));
        await rm(dirname(output), { recursive: true, force: true });
      }
    }
    return { ...result, builds: builds.length };
  }
  return { run, publish, cli };
}

function assertInside(parent, path) {
  const child = relative(realpathSync(parent), realpathSync(path));
  assert(
    child && !child.startsWith("..") && !isAbsolute(child),
    `CLI state escaped its private root: ${path}`,
  );
}

async function command(program, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Mokly fixture command timed out"));
    }, 600_000);
    for (const [stream, append] of [
      [
        child.stdout,
        (chunk) => {
          stdout += chunk;
        },
      ],
      [
        child.stderr,
        (chunk) => {
          stderr += chunk;
        },
      ],
    ]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        append(chunk);
        if (stdout.length + stderr.length > 16 * 1024 * 1024) {
          child.kill("SIGKILL");
          reject(new Error("Mokly fixture output exceeded its bound"));
        }
      });
    }
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

export async function checkoutSources(
  checkout,
  source,
  runtime,
  moves = false,
) {
  if (moves) {
    await cp(join(source, "baseline/catalogue"), join(checkout, "catalogue"), {
      recursive: true,
    });
    await cp(
      join(source, "mokly.config.json"),
      join(checkout, "mokly.config.json"),
    );
  } else {
    await cp(source, checkout, { recursive: true });
  }
  await writeFile(
    join(checkout, ".gitignore"),
    "node_modules\n.context/\nmokly-static/\n.mokly-export-reservations/\n",
  );
  runtime.run(
    "git",
    ["init", "--object-format=sha1", "--initial-branch=fixture"],
    checkout,
  );
  commit(checkout, runtime, "baseline");
}

export function commit(checkout, runtime, side) {
  runtime.run("git", ["add", "-A"], checkout);
  runtime.run(
    "git",
    ["-c", "commit.gpgsign=false", "commit", "-m", `fixture ${side}`],
    checkout,
  );
  const tracked = runtime.run("git", ["ls-files", "--stage"], checkout);
  assert(
    !/^120000 /m.test(tracked) && !tracked.includes("node_modules"),
    "Fixture commits must not contain dependency symlinks",
  );
}
