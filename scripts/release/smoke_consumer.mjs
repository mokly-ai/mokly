import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command.mjs";
import { SMOKE_SOURCE } from "./smoke_source.mjs";
import { NATIVE_TARGETS } from "./targets.mjs";

/** Install immutable archives in a consumer outside the source workspace. */
export async function installConsumer(root, packages, execute = runCommand) {
  const host = NATIVE_TARGETS.find(
    ({ os, cpu }) => os === process.platform && cpu === process.arch,
  );
  assert.ok(host, "consumer smoke requires a supported host");
  const selected = packages.filter(({ report }) =>
    [host.name, "@mokly/mokly", "@mokly/viewer"].includes(report.name),
  );
  assert.equal(selected.length, 3);
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: Object.fromEntries(
          selected.map(({ archivePath, report }) => [
            report.name,
            `file:${archivePath}`,
          ]),
        ),
        devDependencies: {
          typescript: "^6.0.3",
          "@types/react": "^19.3.0",
          "@types/react-dom": "^19.3.0",
          "@types/node": "^26.6.4",
        },
      },
      null,
      2,
    ),
  );
  await execute(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  for (const { report } of selected) {
    const installed = path.join(root, "node_modules", report.name);
    assert.equal((await fs.lstat(installed)).isSymbolicLink(), false);
    const manifest = JSON.parse(
      await fs.readFile(path.join(installed, "package.json"), "utf8"),
    );
    assert.equal(manifest.version, report.version);
  }
  await execute(
    "npm",
    [
      "audit",
      "--omit=dev",
      "--include=prod",
      "--include=optional",
      "--include=peer",
      "--audit-level=low",
    ],
    { cwd: root },
  );
}

export async function smokeAuthoring(root, execute = runCommand) {
  await fs.writeFile(path.join(root, "smoke.mjs"), SMOKE_SOURCE);
  await execute(process.execPath, ["smoke.mjs"], { cwd: root });
  await fs.writeFile(
    path.join(root, "authoring.tsx"),
    `
import { defineScreen, defineComponent } from "@mokly/mokly";
export const screen = defineScreen({ title: "Release screen", description: "A smoke fixture.", relatedDocs: [], props: { label: "Hello" }, render: (props) => <main>{props.label}</main> });
export const component = defineComponent({ title: "Release component", description: "A smoke fixture.", relatedDocs: [], propSchema: { type: "object", properties: { label: { type: "string" } }, required: ["label"], additionalProperties: false } as const, props: { label: "Hello" }, render: (props) => <button>{props.label}</button> });
`,
  );
  await execute(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--strict",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--jsx",
      "react-jsx",
      "--target",
      "ES2023",
      "authoring.tsx",
    ],
    { cwd: root },
  );
  const installed = path.join(root, "node_modules/@mokly/mokly");
  for (const file of [
    "config.schema.json",
    "docs/guides/start/install.md",
    "docs/protocol/mokly-package.md",
    "docs/protocol/mokly-upload-exchange.md",
  ])
    assert.ok((await fs.readFile(path.join(installed, file))).length > 0);
}

export async function smokeBuild(root, version, execute = runCommand) {
  const shim = path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs");
  const options = { cwd: root, env: { MOKLY_OUTPUT: "plain" } };
  const result = await execute(process.execPath, [shim, "--version"], options);
  assert.equal(result.stdout, `${version}\n`);
  await execute("git", ["init", "--quiet"], { cwd: root });
  await fs.mkdir(path.join(root, "specs"));
  await fs.writeFile(path.join(root, "mokly.config.json"), "{}\n");
  await fs.writeFile(path.join(root, ".gitignore"), "site/\nnode_modules/\n");
  await fs.writeFile(
    path.join(root, "specs/hello.screen.html"),
    "---\ntitle: Release hello\n---\n<main>Hello from the installed package</main>\n",
  );
  const built = await execute(
    process.execPath,
    [shim, "build", "--strict", "--no-changes", "--out", "site"],
    options,
  );
  process.stdout.write(result.stdout + built.stdout);
  // A successful validation alone does not prove the installed static builder.
  assert.ok(
    (await fs.readFile(path.join(root, "site/index.html"), "utf8")).includes(
      "<",
    ),
  );
  return shim;
}
