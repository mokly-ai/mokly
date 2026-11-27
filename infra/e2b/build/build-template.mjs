/** Build one E2B template release from its candidate directory with the team API key. */

import { open, readFile, rm } from "node:fs/promises";
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
/** SDK error classes whose message comes from E2B, not from a request header. */
const PROVIDER_ERRORS = [
  "SandboxError",
  "AuthenticationError",
  "BuildError",
  "ServiceBusyError",
];
/** One HTTP header token: Node prints an invalid header value in its error. */
const KEY_SYNTAX = /^[\x21-\x7e]+$/;

const usage =
  "usage: node build-template.mjs SDK_DIRECTORY TEMPLATE_DIRECTORY NAME CPU_COUNT MEMORY_MB";
const [sdkDirectory, templateDirectory, name, cpuCount, memoryMb] =
  process.argv.slice(2);
const apiKey = process.env.E2B_API_KEY ?? "";
let stage = "check the arguments";
let sdk = {};
let receipt;

/** Report a failure without the team key, whatever the error holds. */
function fail(error) {
  const provider = PROVIDER_ERRORS.some(
    (className) =>
      typeof sdk[className] === "function" && error instanceof sdk[className],
  );
  const kind = typeof error?.name === "string" ? error.name : "Error";
  const status = Number.isInteger(error?.statusCode)
    ? ` (HTTP ${error.statusCode})`
    : "";
  const message = String(error.message);
  const detail = provider
    ? `: ${apiKey ? message.split(apiKey).join("[team key]") : message}`
    : "; details are withheld so that they cannot hold the team key";
  process.stderr.write(
    `Template release failed to ${stage}: ${kind}${status}${detail}\n`,
  );
  process.exitCode = 1;
}

async function release() {
  if (!sdkDirectory || !templateDirectory || !name || !cpuCount || !memoryMb) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
    return;
  }
  stage = "check the team key";
  if (!KEY_SYNTAX.test(apiKey)) {
    process.stderr.write(
      "E2B_API_KEY must hold the team API key as one token of visible ASCII characters\n",
    );
    process.exitCode = 2;
    return;
  }
  for (const variable of ROUTING_VARIABLES) delete process.env[variable];
  stage = "claim the receipt";
  const path = join(templateDirectory, "e2b.toml");
  // Claim the receipt before any provider build, so a second run in the same
  // directory starts no build and an existing receipt is never replaced.
  receipt = { path, handle: await open(path, "wx", 0o600), written: false };
  stage = "load the SDK";
  sdk = await import(
    pathToFileURL(resolve(sdkDirectory, "node_modules/e2b/dist/index.mjs")).href
  );
  stage = "read the Dockerfile";
  const dockerfile = await readFile(
    join(templateDirectory, "e2b.Dockerfile"),
    "utf8",
  );
  stage = "build the template";
  const { Template, defaultBuildLogger } = sdk;
  const info = await Template.build(
    Template().fromDockerfile(dockerfile),
    name,
    {
      apiKey,
      apiUrl: E2B_API_URL,
      debug: false,
      cpuCount: Number(cpuCount),
      memoryMB: Number(memoryMb),
      skipCache: true,
      onBuildLogs: defaultBuildLogger(),
    },
  );
  stage = "write the receipt";
  // A bare template ID follows the newest ready build of the name, so a release
  // is deployed and rolled back by the reference that names this exact build.
  const reference = `${info.templateId}:${info.buildId}`;
  await receipt.handle.writeFile(
    `template_name = "${info.name}"\ntemplate_id = "${info.templateId}"\nbuild_id = "${info.buildId}"\nbuild_reference = "${reference}"\n`,
  );
  receipt.written = true;
  process.stdout.write(`Template ${info.name} is ready: ${reference}\n`);
}

/** Close the claim; drop it when no build reference reached it. */
async function settle() {
  if (!receipt) return;
  const { handle, path, written } = receipt;
  receipt = undefined;
  await handle.close();
  if (!written) await rm(path, { force: true });
}

/** A stray SDK error leaves the release in an unknown state: report and stop. */
async function abort(error) {
  fail(error);
  await settle().catch(() => {});
  process.exit(1);
}

process.on("uncaughtException", abort);
process.on("unhandledRejection", abort);
await release()
  .catch(fail)
  .finally(() => settle().catch(fail));
