import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { MoklyError } from "../errors.js";

/** Read the installed package version for the CLI and upload envelope. */
export function packageVersion(): string {
  const packagePath = fileURLToPath(
    new URL("../../package.json", import.meta.url),
  );
  const value = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
    version?: unknown;
  };
  if (typeof value.version !== "string")
    throw new MoklyError("cli-invalid", "package version is missing");
  return value.version;
}
