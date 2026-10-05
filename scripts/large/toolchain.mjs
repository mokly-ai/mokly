/** Archive the package under test and pin the consumer's own install inputs. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { cliPackageRoot } from "../package/layout.mjs";

const execute = promisify(execFile);

export async function prepareDerivedToolchain(repository, root, run = execute) {
  const tooling = path.join(root, "tooling");
  await fs.mkdir(tooling);
  const packed = await run(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", tooling],
    { cwd: cliPackageRoot(repository), maxBuffer: 8 * 1024 * 1024 },
  );
  const [{ filename }] = JSON.parse(packed.stdout);
  await fs.rename(
    path.join(tooling, filename),
    path.join(tooling, "mokly.tgz"),
  );
  const lock = JSON.parse(
    await fs.readFile(path.join(repository, "package-lock.json"), "utf8"),
  );
  const firna = lock.packages["node_modules/@firna/ui"];
  const names = ["@firna/ui", ...Object.keys(firna.peerDependencies)];
  const dependencies = { "@mokly/mokly": "file:tooling/mokly.tgz" };
  for (const name of names) {
    const version = lock.packages[`node_modules/${name}`]?.version;
    if (!version)
      throw new Error(`The large fixture requires a locked ${name}`);
    dependencies[name] = version;
  }
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "mokly-large-fixture",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    ) + "\n",
  );
  for (const argv of [
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    ["ci", "--no-audit", "--no-fund"],
  ]) {
    const result = await run("npm", argv, {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 600_000,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
}
