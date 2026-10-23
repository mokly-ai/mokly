import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { create } from "tar";

import { runNpm } from "./npm.js";
import { git, write } from "./static_changes.js";

export type DependencyTier = 1 | 2 | 3;

const packageName = "mokly-cold-dependency";
const lifecycle = `node -e "require('node:fs').writeFileSync('lifecycle-ran', 'unexpected')"`;

async function archive(root: string, version: string, label: string) {
  const pack = path.join(root, ".context/pack");
  await write(
    pack,
    "package/package.json",
    JSON.stringify({
      name: packageName,
      version,
      type: "module",
      main: "index.js",
      scripts: { install: lifecycle },
    }),
  );
  await write(
    pack,
    "package/index.js",
    `export const label = ${JSON.stringify(label)}; export const welcome = 'Welcome';`,
  );
  const relative = `vendor/dependency-${version}.tgz`;
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await create({ cwd: pack, file, gzip: true, portable: true, noMtime: true }, [
    "package",
  ]);
  return {
    version,
    resolved: `file:${relative}`,
    integrity: `sha512-${createHash("sha512")
      .update(await fs.readFile(file))
      .digest("base64")}`,
  };
}

async function inputs(
  root: string,
  dependency: Awaited<ReturnType<typeof archive>>,
) {
  const identity = { name: "cold-base-fixture", version: "1.0.0" };
  const dependencies = { [packageName]: dependency.resolved };
  await write(
    root,
    "package.json",
    JSON.stringify({
      ...identity,
      dependencies,
      scripts: { preinstall: lifecycle },
    }),
  );
  await write(
    root,
    "package-lock.json",
    JSON.stringify({
      ...identity,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { ...identity, dependencies, hasInstallScript: true },
        [`node_modules/${packageName}`]: {
          ...dependency,
          hasInstallScript: true,
        },
      },
    }),
  );
}

function page(title: string, imports: string, value: string) {
  return `import {definePage} from '@mokly/mokly';
${imports}
export const page = definePage({title: '${title}', description: '', relatedDocs: [],
  render: () => '<!doctype html><html><head><title>${title}</title></head><body><h1>' + ${value} + '</h1></body></html>'});`;
}

/** A real Git base and npm install, with an empty external Mokly cache. */
export async function coldBaseFixture(
  tier: DependencyTier,
  context: TestContext,
) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-cold-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(await fs.realpath(temporary), "repository");
  const cache = path.join(await fs.realpath(temporary), "cache");
  await fs.mkdir(root);
  await fs.mkdir(cache);
  await write(root, ".gitignore", "node_modules/\n.context/\n");
  await write(
    root,
    ".npmrc",
    "offline=true\naudit=false\nfund=false\nupdate-notifier=false\n",
  );
  await write(root, "mokly.config.json", "{}");
  const before = await archive(root, "1.0.0", "Base dependency");
  const working = await archive(root, "2.0.0", "Working dependency");
  const selected = tier === 1 ? working : before;
  await inputs(
    root,
    tier === 3
      ? {
          ...selected,
          resolved: `https://registry.npmjs.org/${packageName}/-/${packageName}-1.0.0.tgz`,
        }
      : selected,
  );
  for (const [name, title, imports, value] of [
    [
      "welcome",
      "Welcome",
      `import {welcome} from '${packageName}';`,
      "welcome",
    ],
    [
      "dependency",
      "Dependency",
      `import {label} from '${packageName}';`,
      "label",
    ],
    ["source", "Source", "import {value} from './source-value';", "value"],
  ] as const) {
    await write(root, `specs/${name}.mockup.ts`, page(title, imports, value));
  }
  await write(
    root,
    "specs/source-value.ts",
    "export const value = 'Base source';",
  );
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "Mokly Test");
  await git(root, "config", "user.email", "test@mokly.invalid");
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "cold base fixture");
  const base = await git(root, "rev-parse", "HEAD");
  await inputs(root, working);
  const env = {
    ...process.env,
    npm_config_offline: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
    npm_config_ignore_scripts: "false",
    npm_config_cache: path.join(root, ".context/npm-cache"),
  };
  await runNpm(["ci", "--ignore-scripts"], { cwd: root, env });
  await write(
    root,
    "specs/source-value.ts",
    "export const value = 'Working source';",
  );
  assert.equal(await git(root, "ls-files", "node_modules"), "");
  assert.deepEqual(await fs.readdir(cache), []);
  return {
    root,
    cache,
    base,
    env: { ...env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache, HOME: cache },
  };
}
