import type { CacheJob, CacheWorkflow } from "./turbo_ci.js";
import { mainCacheCondition, trustedCacheEnvironment } from "./turbo_ci.js";

const protectedSecrets = new Map([
  ["TURBO_CACHE_TRUSTED_WRITE_TOKEN", "turbo-cache-trusted"],
  ["CLOUDFLARE_WORKERS_API_TOKEN", "turbo-cache-deploy"],
]);

function references(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(references);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(references);
  if (typeof value !== "string") return [];
  return [
    ...value.matchAll(/secrets\s*(?:\.\s*(\w+)|\[\s*['"](\w+)['"]\s*\])/gu),
  ].map((match) => (match[1] ?? match[2]!).toUpperCase());
}

function matchingEnvironment(job: CacheJob, expected: string): boolean {
  const name =
    typeof job.environment === "string"
      ? job.environment
      : job.environment?.name;
  return (
    name === expected ||
    (expected === "turbo-cache-trusted" &&
      name === trustedCacheEnvironment.name)
  );
}

/** Audit workflow references; GitHub administrators enforce actual secret scope. */
export function cacheCredentialFindings(
  workflow: CacheWorkflow,
  forbidden: readonly string[],
): string[] {
  const findings: string[] = [];
  for (const name of references(workflow))
    if (forbidden.includes(name))
      findings.push(`Forbidden repository secret alias: ${name}`);
  const { jobs, ...outsideJobs } = workflow;
  for (const name of references(outsideJobs))
    if (protectedSecrets.has(name))
      findings.push(`Protected secret outside a job: ${name}`);
  const events =
    typeof workflow.on === "string"
      ? [workflow.on]
      : Array.isArray(workflow.on)
        ? workflow.on
        : Object.keys(workflow.on);
  const prWorkflow =
    events.includes("pull_request") || events.includes("pull_request_target");
  for (const [id, job] of Object.entries(jobs)) {
    const { steps, ...outsideSteps } = job;
    const uses = [
      { value: outsideSteps, condition: job.if },
      ...steps.map((step) => ({ value: step, condition: step.if ?? job.if })),
    ];
    for (const use of uses)
      for (const name of references(use.value)) {
        const environment = protectedSecrets.get(name);
        if (!environment) continue;
        if (!matchingEnvironment(job, environment))
          findings.push(`${id}: ${name} requires ${environment}`);
        if (prWorkflow && use.condition !== mainCacheCondition)
          findings.push(`${id}: ${name} can reach a pull request job`);
      }
  }
  return findings;
}
