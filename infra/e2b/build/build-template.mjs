/** Build one E2B template release from its candidate directory with the team API key. */

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The only E2B API that receives the team key; the runtime uses the same base. */
const E2B_API_URL = "https://api.e2b.dev";
/** SDK settings that could send the team key to another host or over HTTP. */
const ROUTING_VARIABLES = [
  "E2B_API_URL",
  "E2B_SANDBOX_URL",
  "E2B_DOMAIN",
  "E2B_DEBUG",
];

const usage =
  "usage: node build-template.mjs SDK_DIRECTORY TEMPLATE_DIRECTORY NAME CPU_COUNT MEMORY_MB";
const [sdkDirectory, templateDirectory, name, cpuCount, memoryMb] =
  process.argv.slice(2);
if (!sdkDirectory || !templateDirectory || !name || !cpuCount || !memoryMb) {
  process.stderr.write(`${usage}\n`);
  process.exit(2);
}
const apiKey = process.env.E2B_API_KEY;
if (!apiKey) {
  process.stderr.write("E2B_API_KEY must hold the team API key\n");
  process.exit(2);
}
for (const variable of ROUTING_VARIABLES) delete process.env[variable];

const sdk = pathToFileURL(
  resolve(sdkDirectory, "node_modules/e2b/dist/index.mjs"),
).href;
const { Template, defaultBuildLogger } = await import(sdk);
const dockerfile = await readFile(
  join(templateDirectory, "e2b.Dockerfile"),
  "utf8",
);
const info = await Template.build(Template().fromDockerfile(dockerfile), name, {
  apiKey,
  apiUrl: E2B_API_URL,
  debug: false,
  cpuCount: Number(cpuCount),
  memoryMB: Number(memoryMb),
  onBuildLogs: defaultBuildLogger(),
});
// A bare template ID follows the newest ready build of the name, so a release
// is deployed and rolled back by the reference that names this exact build.
const reference = `${info.templateId}:${info.buildId}`;
await writeFile(
  join(templateDirectory, "e2b.toml"),
  `template_name = "${info.name}"\ntemplate_id = "${info.templateId}"\nbuild_id = "${info.buildId}"\nbuild_reference = "${reference}"\n`,
  { mode: 0o600 },
);
process.stdout.write(`Template ${info.name} is ready: ${reference}\n`);
