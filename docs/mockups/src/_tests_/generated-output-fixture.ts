/** A temporary checkout exercises the public CLI without changing this worktree. */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { generatedResourcePath } from "@mokly/viewer/data";

import { scratchDirectory } from "../../../../apps/_tests_/scratch.mjs";
import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import { outputRoot } from "./catalogue-paths";

const execute = promisify(execFile);
export const repository = path.resolve(import.meta.dirname, "../../../..");

/**
 * The SHA-256 of some bytes, or `missing`. Tests compare large binary files by
 * digest, so that a mismatch fails with a short message.
 */
export function sha256(bytes: Uint8Array | undefined): string {
  return bytes ? createHash("sha256").update(bytes).digest("hex") : "missing";
}

/** The directory that `mokly build` writes when it gets no `--out`. */
export const outputDirectory = path.basename(outputRoot);

/** The catalogue's own self-hosted Inter, which the fixture's stylesheet loads. */
const authoredFont = "docs/mockups/styles/fonts/InterVariable.woff2";
const fontSource = "source/assets/fonts/InterVariable.woff2";

/**
 * Buildable source with an imported stylesheet that loads a binary font, the
 * root Git ignore rules and an `origin` remote. Builds write `mokly-static/`.
 */
export async function outputFixture() {
  const root = scratchDirectory(
    path.join(repository, ".context", "generated-output-"),
  );
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  };
  const run = (command: string, args: readonly string[]) =>
    execute(command, [...args], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30_000,
      env: { ...fixtureGitEnvironment(), GITHUB_ACTIONS: "false" },
    });
  const git = (...args: string[]) => run("git", args);
  /**
   * Run one Mokly command with the fixture's own configuration. Without it,
   * Mokly would search upward and could build this repository's catalogue.
   */
  const cli = (command: string, ...args: string[]) =>
    run(path.join(repository, "node_modules/.bin/mokly"), [
      command,
      "--config",
      path.join(root, "mokly.config.json"),
      ...args,
    ]);
  await write(
    ".gitignore",
    (await readFile(path.join(repository, ".gitignore"), "utf8")) +
      "\n/ts/node_modules\n",
  );
  await write("package.json", '{"private":true}');
  await symlink(
    path.join(repository, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  await write(
    "mokly.config.json",
    JSON.stringify({
      repoRoot: ".",
      roots: [{ dir: "entries", files: ["**/*.mockup.tsx"] }],
      moduleResolution: { packageRoots: ["ts"] },
      review: { base: "main" },
    }),
  );
  await write(
    "source/fixture.css",
    '@font-face { font-family: Fixture; src: url("./assets/fonts/InterVariable.woff2") format("woff2"); }\nmain { font-family: Fixture; }\n',
  );
  await write(
    "entries/screen.mockup.tsx",
    `import {defineScreen} from '@mokly/mokly'; import '../source/fixture.css'; export default defineScreen({title:'Screen',description:'Fixture',relatedDocs:[],render:(_props,context)=><main>{context.viewport}</main>});`,
  );
  await mkdir(path.dirname(path.join(root, fontSource)), { recursive: true });
  await copyFile(
    path.join(repository, authoredFont),
    path.join(root, fontSource),
  );
  await git("init", "-b", "main");
  await git("config", "user.email", "fixture@example.com");
  await git("config", "user.name", "Fixture");
  await git(
    "remote",
    "add",
    "origin",
    "https://github.com/fixture/catalogue.git",
  );
  return {
    root,
    write,
    git,
    cli,
    output: path.join(root, outputDirectory),
    /** The output-relative copy of the font, which the bundled CSS loads. */
    generatedFont: "static/" + generatedResourcePath("assets/" + fontSource),
    sourceFont: path.join(repository, authoredFont),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
