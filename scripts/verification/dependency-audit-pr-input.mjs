import { isHttpsUrl } from "./dependency-audit-exceptions.mjs";
import {
  isInstallLocation,
  isPackageName,
  isRecord,
} from "./dependency-audit-lockfile.mjs";

function inputError(message) {
  return new Error(
    `${message} Fix the input and retry the dependency audit workflow.`,
  );
}

/** Parse the complete CLI before starting file or network operations. */
export function parsePrArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (!["--outcome", "--log", "--report"].includes(name))
      throw inputError(`Unknown dependency update argument ${name}.`);
    const value = args[++index];
    if (!value?.trim() || value.startsWith("--") || options[name.slice(2)])
      throw inputError(`${name} requires one value and must appear once.`);
    options[name.slice(2)] = value;
  }
  if (
    !["success", "failure"].includes(options.outcome) ||
    !options.log ||
    !options.report
  )
    throw inputError(
      "Supply --outcome success|failure, --log <file>, and --report <file>.",
    );
  return options;
}

function baseUrl(value, name) {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "expected an HTTP server URL without credentials, query, or fragment",
      );
    return url.href.replace(/\/+$/u, "");
  } catch {
    throw inputError(`${name} must be a valid HTTP server URL.`);
  }
}

/** Validate Actions metadata and the optional REST base, including enterprise URLs. */
export function prConfiguration(env) {
  for (const name of [
    "GITHUB_TOKEN",
    "GITHUB_REPOSITORY",
    "GITHUB_SERVER_URL",
    "GITHUB_RUN_ID",
  ])
    if (typeof env[name] !== "string" || !env[name].trim())
      throw inputError(`Missing ${name}.`);
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(env.GITHUB_REPOSITORY) ||
    env.GITHUB_REPOSITORY.split("/").some(
      (part) => part === "." || part === "..",
    )
  )
    throw inputError("GITHUB_REPOSITORY must be owner/repository.");
  if (!/^\d+$/u.test(env.GITHUB_RUN_ID))
    throw inputError("GITHUB_RUN_ID must be a numeric run ID.");
  if (/\s/u.test(env.GITHUB_TOKEN))
    throw inputError("GITHUB_TOKEN must be a token without whitespace.");
  const serverUrl = baseUrl(env.GITHUB_SERVER_URL, "GITHUB_SERVER_URL");
  return {
    token: env.GITHUB_TOKEN,
    repository: env.GITHUB_REPOSITORY,
    owner: env.GITHUB_REPOSITORY.split("/")[0],
    serverUrl,
    apiUrl: baseUrl(
      env.GITHUB_API_URL ?? "https://api.github.com",
      "GITHUB_API_URL",
    ),
    runUrl: `${serverUrl}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
  };
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validIssue(issue) {
  if (
    !isRecord(issue) ||
    !isText(issue.message) ||
    Object.hasOwn(issue, "inherited")
  )
    return false;
  if (["exception", "input", "report"].includes(issue.kind)) return true;
  return (
    issue.kind === "finding" &&
    isPackageName(issue.package) &&
    isHttpsUrl(issue.advisoryUrl) &&
    (issue.advisoryId === undefined ||
      (isText(issue.advisoryId) &&
        /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/u.test(
          issue.advisoryId,
        ))) &&
    ["info", "low", "moderate", "high", "critical"].includes(issue.severity) &&
    isText(issue.title) &&
    Array.isArray(issue.installLocations) &&
    issue.installLocations.length > 0 &&
    issue.installLocations.every(isInstallLocation)
  );
}

/** Accept only completed strict reports that agree with the audit step outcome. */
function validatePrSummary(text, outcome) {
  let summary;
  try {
    summary = JSON.parse(text);
  } catch {
    throw inputError("Invalid JSON in the dependency audit report.");
  }
  if (
    !isRecord(summary) ||
    summary.mode !== "strict" ||
    typeof summary.ok !== "boolean" ||
    Object.hasOwn(summary, "comparisonCommit") ||
    !Array.isArray(summary.issues) ||
    !summary.issues.every(validIssue) ||
    summary.ok !== (summary.issues.length === 0)
  )
    throw inputError(
      "Invalid dependency audit report; expected a consistent strict summary with structured issues.",
    );
  if ((outcome === "success") !== summary.ok)
    throw inputError(
      "Dependency audit outcome disagrees with the JSON report.",
    );
  const operational = summary.issues.filter((issue) =>
    ["report", "input"].includes(issue.kind),
  );
  if (operational.length)
    throw new Error(
      `Dependency audit has command, registry, or input failures. Restore the command, registry, or input and retry. ${operational.map((issue) => issue.message).join(" ")}`,
    );
  return summary;
}

/** Read both artifacts before any Git or GitHub call, including read-only calls. */
export async function readPrInputs(options, readFile, clock) {
  const read = async (file) => {
    try {
      const contents = await readFile(file);
      if (typeof contents !== "string")
        throw new TypeError("expected UTF-8 text");
      return contents;
    } catch (cause) {
      throw new Error(
        `Cannot read dependency audit input ${file}. Restore the file and retry.`,
        { cause },
      );
    }
  };
  const report = await read(options.report);
  const log = await read(options.log);
  const summary = validatePrSummary(report, options.outcome);
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw inputError("Invalid dependency update UTC clock.");
  return { summary, log, now };
}
