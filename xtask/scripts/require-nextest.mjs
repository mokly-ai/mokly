import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Read the required nextest version for the install hint. Nextest itself
 * evaluates the requirement, so an unread spelling only shortens the hint.
 */
function requiredVersion() {
  const config = readFileSync(".config/nextest.toml", "utf8");
  const match =
    /^nextest-version\s*=\s*(?:"([^"]+)"|\{[^}]*required\s*=\s*"([^"]+)")/m.exec(
      config,
    ) ?? /^\[nextest-version\][^[]*?^required\s*=\s*"([^"]+)"/ms.exec(config);
  return match?.slice(1).find(Boolean) ?? null;
}

/** Run one nextest command and keep its output. */
function nextest(args) {
  return spawnSync("cargo", ["nextest", ...args], { encoding: "utf8" });
}

function installSteps(version, problem) {
  const pin = version ?? "{version}";
  return [
    `${problem} The Rust tests of cargo xtask check run with it.`,
    `Install the cargo-nextest version that .config/nextest.toml requires:`,
    `  cargo install cargo-nextest --locked --version ${pin}`,
    `  cargo binstall cargo-nextest@${pin}`,
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
