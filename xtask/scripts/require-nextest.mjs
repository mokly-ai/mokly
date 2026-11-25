import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Read the nextest version that `.config/nextest.toml` requires. */
function requiredVersion() {
  const config = readFileSync(".config/nextest.toml", "utf8");
  const match = /^nextest-version\s*=.*required\s*=\s*"([^"]+)"/m.exec(config);
  if (!match) throw new Error(".config/nextest.toml names no required nextest");
  return match[1];
}

/** Run one nextest command and keep its output. */
function nextest(args) {
  return spawnSync("cargo", ["nextest", ...args], { encoding: "utf8" });
}

function installSteps(version, problem) {
  return [
    `${problem} The Rust tests of cargo xtask check run with it.`,
    `Install cargo-nextest ${version} with one of these commands:`,
    `  cargo install cargo-nextest --locked --version ${version}`,
    `  cargo binstall cargo-nextest@${version}`,
    "Prebuilt binaries: https://nexte.st/docs/installation/pre-built-binaries/",
    "",
  ].join("\n");
}

const version = requiredVersion();
const probe = nextest(["--version"]);
if (probe.error || probe.status !== 0) {
  process.stderr.write(installSteps(version, "cargo-nextest is missing."));
  process.exitCode = 1;
} else {
  // Nextest evaluates the `nextest-version` requirement of the configuration.
  const requirement = nextest(["show-config", "version"]);
  if (requirement.error || requirement.status !== 0) {
    process.stderr.write(
      `${requirement.stdout ?? ""}${requirement.stderr ?? ""}`,
    );
    const installed = probe.stdout.split("\n")[0];
    process.stderr.write(
      installSteps(version, `${installed} does not meet the requirement.`),
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(probe.stdout.split("\n")[0] + "\n");
  }
}
