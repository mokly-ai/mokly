import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Read the nextest version that `.config/nextest.toml` requires. */
function requiredVersion() {
  const config = readFileSync(".config/nextest.toml", "utf8");
  const match = /^nextest-version\s*=.*required\s*=\s*"([^"]+)"/m.exec(config);
  if (!match) throw new Error(".config/nextest.toml names no required nextest");
  return match[1];
}

const version = requiredVersion();
const probe = spawnSync("cargo", ["nextest", "--version"], {
  encoding: "utf8",
});
if (probe.error || probe.status !== 0) {
  process.stderr.write(
    [
      "cargo-nextest is missing. The Rust tests of cargo xtask check run with it.",
      `Install cargo-nextest ${version} with one of these commands:`,
      `  cargo install cargo-nextest --locked --version ${version}`,
      `  cargo binstall cargo-nextest@${version}`,
      "Prebuilt binaries: https://nexte.st/docs/installation/pre-built-binaries/",
      "",
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  process.stdout.write(probe.stdout.split("\n")[0] + "\n");
}
