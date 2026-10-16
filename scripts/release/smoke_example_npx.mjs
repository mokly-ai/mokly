/**
 * The packed example smoke's zero-install half: build the copy again through
 * `npm exec --package` with an empty npm cache and no Mokly package in the
 * copy. The renderer's and the PostCSS configuration's imports exist only in
 * the copy, and every load of React or React DOM from the npx cache fails, so
 * the build shows that these modules resolve from the copy, never from the
 * npx cache (`mokly-rendering.md`).
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command.mjs";

/** The imports of the example's renderer and PostCSS configuration. */
const COPY_ONLY = ["@firna/ui", "@tailwindcss/postcss", "autoprefixer"];

/** The viewer's React peers, which npm also installs into the npx cache. */
const GUARDED = ["react", "react-dom"];

const SENTINEL = "./mokly-smoke-sentinel.cjs";

async function exists(file) {
  return fs.stat(file).then(
    () => true,
    () => false,
  );
}

/** Every file below `root`, as sorted relative paths. */
async function files(root) {
  const entries = await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)),
    )
    .sort();
}

/**
 * Point every entry of a package in the npx cache at a module that throws. A
 * named ESM import of it fails to link, and every other load throws.
 */
async function guard(directory) {
  const file = path.join(directory, "package.json");
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));
  await fs.writeFile(
    path.join(directory, SENTINEL),
    `throw new Error(${JSON.stringify(`${manifest.name} loaded from the npx cache`)});\n`,
  );
  const guarded = {
    ...manifest,
    main: SENTINEL,
    module: undefined,
    browser: undefined,
    exports: {
      ".": SENTINEL,
      "./package.json": "./package.json",
      "./*": SENTINEL,
    },
  };
  await fs.writeFile(file, `${JSON.stringify(guarded, null, 2)}\n`);
}

async function guarded(directory) {
  const file = path.join(directory, "package.json");
  return JSON.parse(await fs.readFile(file, "utf8")).main === SENTINEL;
}

/**
 * Remove the installed Mokly packages from the copy. Then run the archives'
 * `mokly` through npx in the configuration's directory with an empty npm
 * cache: `--version` installs it into that cache, and a strict build follows
 * once every load of React and React DOM there fails. The build discovers the
 * configuration, writes the same files as the installed CLI's build, and
 * installs nothing into the copy.
 */
export async function npxBuild(consumer, packages, scratch) {
  const modules = path.join(consumer, "node_modules");
  await fs.rm(path.join(modules, "@mokly"), { recursive: true });
  await fs.rm(path.join(modules, ".bin/mokly"), { force: true });
  // npm then reads the copy's tree from its folders.
  await fs.rm(path.join(modules, ".package-lock.json"), { force: true });
  const cache = path.join(scratch, "npm-cache");
  await fs.mkdir(cache);
  const npx = (args) =>
    runCommand(
      "npm",
      [
        "exec",
        "--yes",
        "--cache",
        cache,
        ...packages.flatMap(({ archivePath }) => [
          "--package",
          `file:${archivePath}`,
        ]),
        "--",
        "mokly",
        ...args,
      ],
      {
        cwd: path.join(consumer, "examples/basic"),
        env: { MOKLY_OUTPUT: "plain" },
      },
    );
  const cli = packages.find(({ report }) => report.name === "@mokly/mokly");
  assert.equal((await npx(["--version"])).stdout.trim(), cli.report.version);
  const [install, ...others] = await fs.readdir(path.join(cache, "_npx"));
  assert.deepEqual(others, [], "one npx install");
  const cached = path.join(cache, "_npx", install, "node_modules");
  assert.ok(await exists(path.join(cached, "@mokly/mokly/package.json")));
  for (const name of COPY_ONLY)
    assert.equal(await exists(path.join(cached, name)), false, name);
  for (const name of GUARDED) await guard(path.join(cached, name));
  const { stdout, stderr } = await npx([
    "build",
    "--strict",
    "--no-changes",
    "--sidecars",
    "1",
    "--out",
    "../../npx-site",
  ]);
  process.stdout.write(stdout + stderr);
  for (const name of GUARDED)
    assert.ok(await guarded(path.join(cached, name)), `${name} stayed guarded`);
  assert.equal(await exists(path.join(modules, "@mokly")), false);
  assert.deepEqual(
    await files(path.join(consumer, "npx-site")),
    await files(path.join(consumer, "site")),
  );
}
