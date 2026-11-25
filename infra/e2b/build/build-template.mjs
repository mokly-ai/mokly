/** Build one E2B template release from its candidate directory with the team API key. */

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const usage =
  "usage: node build-template.mjs SDK_DIRECTORY TEMPLATE_DIRECTORY NAME CPU_COUNT MEMORY_MB";
const [sdkDirectory, templateDirectory, name, cpuCount, memoryMb] =
  process.argv.slice(2);
if (!sdkDirectory || !templateDirectory || !name || !cpuCount || !memoryMb) {
  process.stderr.write(`${usage}\n`);
  process.exit(2);
}
if (!process.env.E2B_API_KEY) {
  process.stderr.write("E2B_API_KEY must hold the team API key\n");
  process.exit(2);
}

const sdk = pathToFileURL(
  resolve(sdkDirectory, "node_modules/e2b/dist/index.mjs"),
).href;
const { Template, defaultBuildLogger } = await import(sdk);
const dockerfile = await readFile(
  join(templateDirectory, "e2b.Dockerfile"),
  "utf8",
);
const info = await Template.build(Template().fromDockerfile(dockerfile), name, {
  cpuCount: Number(cpuCount),
  memoryMB: Number(memoryMb),
  onBuildLogs: defaultBuildLogger(),
});
await writeFile(
  join(templateDirectory, "e2b.toml"),
  `template_name = "${info.name}"\ntemplate_id = "${info.templateId}"\nbuild_id = "${info.buildId}"\n`,
  { mode: 0o600 },
);
process.stdout.write(`Template ${info.name} is ready: ${info.templateId}\n`);
