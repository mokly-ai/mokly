import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runtimeDirectory } from "./server-process";

const environmentPath = resolve(runtimeDirectory, "api-environment.json");

/** Retain this run's schema and blob settings for an isolated API replacement. */
export function saveApiEnvironment(environment: Record<string, string>): void {
  writeFileSync(environmentPath, JSON.stringify(environment));
}

/** Read only the settings the suite recorded when it prepared its runtime. */
export function savedApiEnvironment(): Record<string, string> {
  const value: unknown = JSON.parse(readFileSync(environmentPath, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("[app/tests] The saved API environment must be an object.");
  }
  const environment: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error("[app/tests] A saved API setting must be a string.");
    }
    environment[key] = entry;
  }
  return environment;
}
