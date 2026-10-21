import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import {
  installFixture,
  instrumentManagers,
  managerName,
  managerPath,
  type Manager,
} from "./base_manager_tools.js";
import { coldBaseFixture } from "./cold_base_fixture.js";
import { git, write } from "./static_changes.js";

const script = `node -e "require('node:fs').writeFileSync('lifecycle-ran', 'unexpected')"`;

export async function baseManagerFixture(
  manager: Manager,
  context: TestContext,
  mode:
    | "installed"
    | "missing"
    | "version"
    | "pnp"
    | "paths"
    | "exec"
    | "constraints" = "installed",
) {
  const fixture = await coldBaseFixture(2, context);
  const { root } = fixture;
  await git(root, "checkout", "HEAD", "--", "specs/source-value.ts");
  await fs.rm(path.join(root, "package-lock.json"));
  await fs.rm(path.join(root, "node_modules"), { recursive: true });
  await write(
    root,
    ".gitignore",
    "node_modules/\n.context/\n.yarn/install-state.gz\n",
  );
  if (managerName(manager) === "pnpm") {
    await write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  } else if (manager.name === "Yarn Berry") {
    await write(
      root,
      ".yarnrc.yml",
      "nodeLinker: node-modules\nenableNetwork: false\nenableGlobalCache: false\nenableTelemetry: false\nenableScripts: true\n",
    );
  } else {
    await write(root, ".yarnrc", "disable-self-update-check true\n");
  }
  if (mode === "constraints") {
    await write(
      root,
      ".yarnrc.yml",
      "nodeLinker: node-modules\nenableNetwork: false\nenableGlobalCache: false\nenableTelemetry: false\nenableConstraintsChecks: true\n",
    );
    await write(
      root,
      "yarn.config.cjs",
      "require('node:fs').writeFileSync('historical-constraints-ran', 'unexpected'); module.exports = {};\n",
    );
  }
  await write(
    root,
    "packages/local/package.json",
    JSON.stringify({
      name: "local-workspace",
      version: "1.0.0",
      main: "index.js",
      scripts: { postinstall: script },
    }),
  );
  await write(
    root,
    "packages/local/index.js",
    "module.exports = 'Base workspace';",
  );
  await write(
    root,
    "specs/workspace.mockup.ts",
    `import {definePage} from '@mokly/mokly';
import value from 'local-workspace';
export const page = definePage({title: 'Workspace', description: '', relatedDocs: [],
render: () => '<!doctype html><html><head><title>Workspace</title></head><body><h1>' + value + '</h1></body></html>'});`,
  );
  const manifest = (version: string, includeExec = mode === "exec") =>
    JSON.stringify({
      name: "cold-base-fixture",
      version: "1.0.0",
      private: true,
      packageManager: `${managerName(manager)}@${manager.version}`,
      workspaces: ["packages/*"],
      dependencies: {
        "mokly-cold-dependency": `file:vendor/dependency-${version}.tgz`,
        "local-workspace":
          manager.name === "Yarn Classic" ? "*" : "workspace:*",
        ...(includeExec
          ? { generator: "exec:./historical-generator.cjs" }
          : {}),
      },
      scripts: { preinstall: script, postinstall: script },
      dependenciesMeta: { "mokly-cold-dependency": { built: true } },
    });
  await write(root, "package.json", manifest("1.0.0", false));
  if (mode === "exec") {
    await write(
      root,
      "packages/generator/package.json",
      JSON.stringify({ name: "generator", version: "1.0.0" }),
    );
    await write(
      root,
      "historical-generator.cjs",
      "require('node:fs').writeFileSync('historical-exec-ran', 'unexpected'); module.exports = {};\n",
    );
  }
  await installFixture(root, manager, fixture.env);
  if (mode === "exec") {
    await write(root, "package.json", manifest("1.0.0"));
  }
  if (mode === "constraints")
    await fs.rm(path.join(root, "historical-constraints-ran"), { force: true });
  if (mode === "exec")
    await fs.rm(path.join(root, "historical-exec-ran"), { force: true });
  if (mode === "paths")
    await write(
      root,
      ".npmrc",
      "offline=true\nlockfile-dir=../escaped-lock\nmodules-dir=../escaped-modules\nvirtual-store-dir=../escaped-virtual\nstore-dir=../escaped-store\n",
    );
  if (mode === "paths" && manager.name !== "pnpm") {
    await write(
      root,
      "pnpm-workspace.yaml",
      "packages:\n  - packages/*\nlockfileDir: ../escaped-lock\nmodulesDir: ../escaped-modules\nvirtualStoreDir: ../escaped-virtual\nstoreDir: ../escaped-store\n",
    );
  }
  if (mode === "version") {
    await write(
      root,
      "package.json",
      manifest("1.0.0").replace(manager.version, "999.0.0"),
    );
  }
  if (mode === "pnp") await write(root, ".yarnrc.yml", "nodeLinker: pnp\n");
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "manager base fixture");
  const base = await git(root, "rev-parse", "HEAD");
  await write(root, "package.json", manifest("2.0.0", false));
  if (mode === "paths") {
    await write(root, ".npmrc", "offline=true\n");
    await write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  }
  if (mode === "pnp")
    await write(
      root,
      ".yarnrc.yml",
      "nodeLinker: node-modules\nenableNetwork: false\nenableGlobalCache: false\nenableTelemetry: false\n",
    );
  await installFixture(root, manager, fixture.env);
  if (mode === "constraints")
    await fs.rm(path.join(root, "historical-constraints-ran"), { force: true });
  await write(
    root,
    "specs/source-value.ts",
    "export const value = 'Working source';",
  );
  if (mode === "exec")
    await fs.rm(path.join(root, "historical-exec-ran"), { force: true });
  await write(
    root,
    "packages/local/index.js",
    "module.exports = 'Working workspace';",
  );
  const probe = await instrumentManagers(root);
  const PATH = await managerPath(root, manager, mode === "missing");
  return {
    ...fixture,
    base,
    calls: probe.calls,
    managerOutput: probe.output,
    network: probe.network,
    env: {
      ...fixture.env,
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((key) => key.toLowerCase() === "path")
          .map((key) => [key, PATH]),
      ),
      PATH,
      NODE_OPTIONS: probe.NODE_OPTIONS,
    },
  };
}
