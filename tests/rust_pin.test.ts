import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

/** The only accepted Rust setup command: rustup reads `rust-toolchain.toml`. */
const TOOLCHAIN_INSTALL = "rustup toolchain install";
/** Workflows whose jobs run cargo or prepare a box that runs cargo. */
const RUST_WORKFLOWS = [
  "ci.yml",
  "release.yml",
  "blacksmith-testbox.yml",
] as const;
/** Docs that name the pinned Rust version for developers and automation. */
const RUST_PIN_DOCS = [
  "README.md",
  "docs/protocol/ci-workflow.md",
  "docs/protocol/npm-release-management.md",
  "docs/protocol/remote-verification-testbox.md",
] as const;
/** A rustup command that selects a toolchain outside `rust-toolchain.toml`. */
const VERSION_SELECTION =
  /rustup (?:toolchain install|default|override set)[ \t]+\S/u;

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  steps?: readonly WorkflowStep[];
}

interface Workflow {
  jobs: Readonly<Record<string, WorkflowJob>>;
}

interface ToolchainPin {
  channel: string;
  profile: string | undefined;
  components: readonly string[];
}

test("rust-toolchain.toml pins an exact release with rustfmt and clippy", async () => {
  const pin = await toolchainPin();
  assert.match(
    pin.channel,
    /^\d+\.\d+\.\d+$/u,
    "the toolchain channel must be an exact Rust release",
  );
  assert.equal(pin.profile, "minimal");
  assert.deepEqual([...pin.components].sort(), ["clippy", "rustfmt"]);
});

test("the pinned toolchain is the workspace rust-version release", async () => {
  const pin = await toolchainPin();
  const rustVersion = /^rust-version = "([^"]+)"$/mu.exec(
    await read("Cargo.toml"),
  )?.[1];
  assert.ok(rustVersion, "Cargo.toml must declare a workspace rust-version");
  assert.ok(
    pin.channel === rustVersion || pin.channel.startsWith(`${rustVersion}.`),
    `rust-toolchain.toml pins ${pin.channel} but Cargo.toml requires ${rustVersion}`,
  );
});

test("automation selects Rust only through rust-toolchain.toml", async () => {
  for (const { file, source } of await automationSources()) {
    const selection = VERSION_SELECTION.exec(source);
    assert.equal(
      selection,
      null,
      `${file} must not name a Rust toolchain: ${selection?.[0]}`,
    );
  }
});

test("Rust jobs install the pinned toolchain before cargo runs", async () => {
  let setups = 0;
  for (const file of RUST_WORKFLOWS) {
    const workflow = parse(await read(`.github/workflows/${file}`)) as Workflow;
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps ?? [];
      const setup = steps.findIndex((step) => step.name === "Set up Rust");
      const cargo = steps.findIndex((step) =>
        /\bcargo\b/u.test(step.run ?? ""),
      );
      if (setup < 0 && cargo < 0) continue;
      setups += 1;
      assert.equal(
        steps[setup]?.run,
        TOOLCHAIN_INSTALL,
        `${file}:${name} must set up Rust with "${TOOLCHAIN_INSTALL}"`,
      );
      if (cargo >= 0)
        assert.ok(
          setup < cargo,
          `${file}:${name} must set up Rust before cargo`,
        );
    }
  }
  assert.ok(setups > 0, "CI, release and Testbox workflows must set up Rust");
});

test("developer and protocol docs name the pinned Rust version", async () => {
  const { channel } = await toolchainPin();
  for (const file of RUST_PIN_DOCS) {
    const source = (await read(file)).replace(/\s+/gu, " ");
    assert.ok(
      source.includes(`Rust ${channel}`),
      `${file} must name Rust ${channel}`,
    );
  }
  assert.ok(
    (await read("README.md")).includes(
      "[`rust-toolchain.toml`](./rust-toolchain.toml)",
    ),
    "development setup must follow the pinned Rust toolchain",
  );
});

async function toolchainPin(): Promise<ToolchainPin> {
  const source = await read("rust-toolchain.toml");
  assert.ok(
    source.startsWith("[toolchain]\n"),
    "rust-toolchain.toml must start with the [toolchain] table",
  );
  const channel = /^channel = "([^"]+)"$/mu.exec(source)?.[1];
  assert.ok(channel, "rust-toolchain.toml must set a channel");
  const components = /^components = \[([^\]]*)\]$/mu.exec(source)?.[1] ?? "";
  return {
    channel,
    profile: /^profile = "([^"]+)"$/mu.exec(source)?.[1],
    components: [...components.matchAll(/"([^"]+)"/gu)].map(
      (match) => match[1]!,
    ),
  };
}

async function automationSources(): Promise<
  readonly { file: string; source: string }[]
> {
  const workflows = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  )
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => `.github/workflows/${name}`);
  const actionEntries = await fs.readdir(
    path.join(repositoryRoot, ".github/actions"),
    { withFileTypes: true },
  );
  const actions = actionEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `.github/actions/${entry.name}/action.yml`);
  return await Promise.all(
    [...workflows, ...actions].map(async (file) => ({
      file,
      source: await read(file),
    })),
  );
}

async function read(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}
