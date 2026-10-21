import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import {
  cli,
  instrumentManagers,
  managerName,
  managerPath,
  type Manager,
} from "./base_manager_tools.js";
import { coldBaseFixture } from "./cold_base_fixture.js";
import { localRegistry } from "./local_registry.js";
import { git, write } from "./static_changes.js";

const execute = promisify(execFile);
const dependency = "mokly-cold-dependency";
const token = "user-registry-token";
const script = `node -e "require('node:fs').writeFileSync('lifecycle-ran', 'unexpected')"`;

/**
 * One attempt by a base configuration to read a secret during the install.
 * `authPlaceholder` goes into the base auth key, `env` is set in the build
 * environment, and `inject` uses a Yarn Berry environment file outside the
 * repository. The test asserts whether `secret` reaches the registry.
 */
export type RegistryAttack = {
  env?: Record<string, string>;
  authPlaceholder?: string;
  secret: string;
  mustLeak: boolean;
  inject?: boolean;
};

/**
 * A cold base whose locked dependency comes from a local registry. The
 * project configuration selects the registry and the user configuration
 * holds its token, so a tier-two install proves that the manager reads both.
 * With `attack`, the committed base also tries to read a secret.
 */
export async function baseRegistryFixture(
  manager: Manager,
  context: TestContext,
  attack?: RegistryAttack,
) {
  const fixture = await coldBaseFixture(2, context);
  const { root, cache } = fixture;
  const registry = await localRegistry(
    context,
    dependency,
    await Promise.all(
      ["1.0.0", "2.0.0"].map(async (version) => ({
        version,
        tarball: await fs.readFile(
          path.join(root, `vendor/dependency-${version}.tgz`),
        ),
      })),
    ),
    token,
  );
  await git(root, "checkout", "HEAD", "--", "specs/source-value.ts");
  await fs.rm(path.join(root, "package-lock.json"));
  await fs.rm(path.join(root, "node_modules"), { recursive: true });
  await write(
    root,
    ".gitignore",
    "node_modules/\n.context/\n.yarn/cache/\n.yarn/install-state.gz\n",
  );
  const host = `//127.0.0.1:${registry.port}`;
  const home = path.join(root, ".context/manager-home");
  for (const directory of [home, cache]) {
    await write(
      directory,
      ".npmrc",
      `${host}/:_authToken=${token}\n${host}/:always-auth=true\n`,
    );
    await write(
      directory,
      ".yarnrc.yml",
      `npmRegistries:\n  "${host}":\n    npmAuthToken: ${token}\n    npmAlwaysAuth: true\n`,
    );
  }
  const berry = manager.name === "Yarn Berry";
  const projectFile = berry ? ".yarnrc.yml" : ".npmrc";
  const projectBody = berry
    ? `nodeLinker: node-modules\nnpmRegistryServer: "${registry.url}"\nunsafeHttpWhitelist:\n  - "127.0.0.1"\nenableGlobalCache: false\nenableTelemetry: false\n`
    : `registry=${registry.url}/\n`;
  await write(root, projectFile, projectBody);
  // The npm test runner exports its own registry and user configuration.
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(fixture.env).filter(
        ([key]) => !/^(npm_config_|yarn_)/iu.test(key),
      ),
    ),
    USERPROFILE: cache,
    npm_config_userconfig: path.join(cache, ".npmrc"),
  };
  const manifest = (version: string) =>
    JSON.stringify({
      name: "cold-base-fixture",
      version: "1.0.0",
      private: true,
      packageManager: `${managerName(manager)}@${manager.version}`,
      dependencies: { [dependency]: version },
      scripts: { preinstall: script, postinstall: script },
    });
  await write(root, "package.json", manifest("1.0.0"));
  const owner = {
    ...env,
    HOME: home,
    USERPROFILE: home,
    npm_config_userconfig: path.join(home, ".npmrc"),
  };
  await install(root, manager, owner);
  // Plant the attack into the committed base only. The fixture's own installs
  // run with the user token and no secret, so they keep making the lockfile.
  if (attack)
    await write(
      root,
      projectFile,
      projectBody + (await attackBody(attack, host, berry, root, context)),
    );
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "registry base fixture");
  const base = await git(root, "rev-parse", "HEAD");
  if (attack) await write(root, projectFile, projectBody);
  await write(root, "package.json", manifest("2.0.0"));
  await install(root, manager, owner);
  await write(
    root,
    "specs/source-value.ts",
    "export const value = 'Working source';",
  );
  registry.requests.length = 0;
  const probe = await instrumentManagers(root, registry.port);
  const PATH = await managerPath(root, manager, false);
  return {
    ...fixture,
    base,
    registry,
    calls: probe.calls,
    managerOutput: probe.output,
    network: probe.network,
    env: {
      ...env,
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((key) => key.toLowerCase() === "path")
          .map((key) => [key, PATH]),
      ),
      PATH,
      NODE_OPTIONS: probe.NODE_OPTIONS,
      HTTP_PROXY: "http://127.0.0.1:9",
      HTTPS_PROXY: "http://127.0.0.1:9",
      NO_PROXY: "127.0.0.1,localhost",
      ...(attack?.env ?? {}),
    },
  };
}

/** The exfiltration block for the committed base project configuration. */
async function attackBody(
  attack: RegistryAttack,
  host: string,
  berry: boolean,
  root: string,
  context: TestContext,
): Promise<string> {
  if (attack.inject) {
    const outside = path.join(path.dirname(root), "outside-secret.env");
    await fs.writeFile(outside, `INJECTED_SECRET=${attack.secret}\n`);
    context.after(() => fs.rm(outside, { force: true }));
    return `injectEnvironmentFiles:\n  - ${JSON.stringify(outside)}\nnpmRegistries:\n  "${host}":\n    npmAuthToken: "\${INJECTED_SECRET}"\n    npmAlwaysAuth: true\n`;
  }
  const placeholder = attack.authPlaceholder ?? "";
  return berry
    ? `npmRegistries:\n  "${host}":\n    npmAuthToken: "${placeholder}"\n    npmAlwaysAuth: true\n`
    : `${host}/:_authToken=${placeholder}\n${host}/:always-auth=true\n`;
}

async function install(root: string, manager: Manager, env: NodeJS.ProcessEnv) {
  const args =
    managerName(manager) === "pnpm"
      ? [
          "install",
          "--ignore-scripts",
          "--ignore-pnpmfile",
          "--config.pm-on-fail=ignore",
          "--config.manage-package-manager-versions=false",
          "--store-dir",
          path.join(root, ".context/store"),
        ]
      : manager.name === "Yarn Classic"
        ? [
            "install",
            "--ignore-scripts",
            "--non-interactive",
            "--cache-folder",
            path.join(root, ".context/yarn-cache"),
          ]
        : ["install", "--mode=skip-build"];
  await execute(process.execPath, [cli(manager), ...args], {
    cwd: root,
    env: {
      ...env,
      LOCALAPPDATA: path.join(root, ".context/manager-home"),
      XDG_CACHE_HOME: path.join(root, ".context/manager-home"),
      YARN_ENABLE_IMMUTABLE_INSTALLS: "false",
      YARN_ENABLE_TELEMETRY: "false",
    },
  });
}
