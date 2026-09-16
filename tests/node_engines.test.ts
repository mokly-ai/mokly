import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

interface Package {
  cpu?: string[];
  engines?: { node?: string };
  optional?: boolean;
  os?: string[];
  version?: string;
}

/** Platforms the repository installs on: Ubuntu, macOS and Windows x64. */
const INSTALLED_PLATFORMS = [
  { cpu: "x64", os: "linux" },
  { cpu: "arm64", os: "darwin" },
  { cpu: "x64", os: "darwin" },
  { cpu: "x64", os: "win32" },
];

/**
 * An optional platform artifact that no supported installation selects never
 * runs, so its engine range cannot break a supported install.
 */
function installedSomewhere(entry: Package): boolean {
  if (entry.optional !== true || (!entry.os && !entry.cpu)) return true;
  return INSTALLED_PLATFORMS.some(
    (platform) =>
      (!entry.os || entry.os.includes(platform.os)) &&
      (!entry.cpu || entry.cpu.includes(platform.cpu)),
  );
}

const require = createRequire(import.meta.url);
const semver = require("semver") as {
  minVersion(range: string): { version: string } | null;
  satisfies(version: string, range: string): boolean;
};
const root = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as Package;
const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
) as { packages: Record<string, Package> };

test("an optional artifact for an uninstalled platform is not checked", () => {
  assert.equal(
    installedSomewhere({ cpu: ["ia32"], optional: true, os: ["win32"] }),
    false,
  );
  assert.equal(
    installedSomewhere({ cpu: ["x64"], optional: true, os: ["linux"] }),
    true,
  );
  assert.equal(installedSomewhere({ os: ["win32"], cpu: ["ia32"] }), true);
});

test("every locked Node engine range accepts the declared minimum runtime", () => {
  const minimum = semver.minVersion(root.engines?.node ?? "")?.version;
  assert.equal(minimum, "22.14.0");
  assert.equal(lock.packages[""]?.engines?.node, root.engines?.node);
  const failures = Object.entries(lock.packages).flatMap(([name, entry]) => {
    const range = entry.engines?.node;
    return range &&
      installedSomewhere(entry) &&
      !semver.satisfies(minimum!, range)
      ? [`${name}@${entry.version ?? "workspace"}: ${range}`]
      : [];
  });
  assert.deepEqual(
    failures,
    [],
    `Incompatible with Node ${minimum}:\n${failures.join("\n")}`,
  );
});
