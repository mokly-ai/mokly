import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { consumer } from "../helpers/mokly_serve.js";
import { git, write } from "../helpers/static_changes.js";

export async function viteEnvChangesFixture(context: TestContext) {
  const screen = (
    name: string,
  ) => `export const ${name.toLowerCase()} = defineScreen({
  path: '${name.toLowerCase()}', title: '${name}', description: '', relatedDocs: [],
  render: () => <h1>{import.meta.env.VITE_TRACK_D_${name} ?? 'missing'}</h1>,
});`;
  const root = await consumer(context, {
    ".gitignore": "node_modules/\n.context/\n.env.local\n",
    "package.json": '{"private":true,"type":"module"}',
    "mokly.config.json": JSON.stringify({
      vite: true,
      roots: [{ dir: "src" }],
      review: { base: "fixture-base" },
    }),
    "vite.config.ts": "export default { envDir: 'env' };",
    "src/screens.mockup.tsx": [
      'import { defineScreen } from "@mokly/mokly";',
      ...["LOCAL", "TRACKED", "STAGED", "REMOVED"].map(screen),
    ].join("\n"),
    "env/.env": "VITE_TRACK_D_TRACKED=base\nVITE_TRACK_D_PREFIX=expanded\n",
    "env/.env.development.local": "VITE_TRACK_D_REMOVED=base-only-tracked\n",
  });
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "Mokly Test");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "add", ".");
  await git(root, "commit", "-qm", "base env fixture");
  await git(root, "branch", "fixture-base");
  await write(
    root,
    "env/.env.local",
    "VITE_TRACK_D_LOCAL=$VITE_TRACK_D_PREFIX-local\n",
  );
  await write(
    root,
    "env/.env",
    "VITE_TRACK_D_TRACKED=head\nVITE_TRACK_D_PREFIX=expanded\n",
  );
  await write(root, "env/.env.development", "VITE_TRACK_D_STAGED=index-only\n");
  await git(root, "add", "env/.env.development");
  await git(root, "rm", "--cached", "env/.env.development.local");
  await write(
    root,
    "env/.env.development.local",
    "VITE_TRACK_D_REMOVED=working-copy\n",
  );
  return root;
}

export async function linkIgnoredViteEnv(context: TestContext, root: string) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-shared-env-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(root, "env/.env.local");
  const target = path.join(directory, "shared.env");
  await fs.rename(file, target);
  await fs.symlink(target, file, "file");
  return target;
}

export function envSnapshot(output: string, prefix: string, screen: string) {
  return fs.readFile(
    path.join(output, prefix, "mokly-generated", screen, "index.mobile.html"),
    "utf8",
  );
}
