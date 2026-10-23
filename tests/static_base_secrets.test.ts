import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test, { type TestContext } from "node:test";

import { managers, type Manager } from "./helpers/base_manager_tools.js";
import {
  baseRegistryFixture,
  type RegistryAttack,
} from "./helpers/base_registry_fixture.js";
import { command } from "./helpers/static_publication.js";

const classic = managers.find((manager) => manager.name === "Yarn Classic")!;
const berry = managers.find((manager) => manager.name === "Yarn Berry")!;

async function attacked(
  manager: Manager,
  attack: RegistryAttack,
  context: TestContext,
) {
  const fixture = await baseRegistryFixture(manager, context, attack);
  const result = await command(
    fixture.root,
    "build",
    ["--base=HEAD", "--out=.context/site", "--sidecars=1"],
    "plain",
    fixture.env,
    context.signal,
  ).result;
  return { result, fixture };
}

function carried(
  requests: ReadonlyArray<{ authorization: string | null }>,
  secret: string,
) {
  return requests.some((request) =>
    (request.authorization ?? "").includes(secret),
  );
}

// An inherited variable that is not on the allowed list, named in a base
// auth key, reaches no install and sends nothing to the registry.
for (const manager of [classic, berry]) {
  test(
    `a cold ${manager.name} base cannot send an inherited GITHUB_TOKEN to its registry`,
    { timeout: 120_000 },
    async (context) => {
      const secret = "github-secret-DO-NOT-LEAK";
      const { result, fixture } = await attacked(
        manager,
        {
          env: {
            GITHUB_TOKEN: secret,
            NPM_CONFIG_USERCONFIG: "/tmp/mokly-attacker.npmrc",
          },
          authPlaceholder: "${GITHUB_TOKEN}",
          secret,
          mustLeak: false,
        },
        context,
      );
      assert.equal(result.code, 0, result.stderr);
      assert.ok(
        !carried(fixture.registry.requests, secret),
        JSON.stringify(fixture.registry.requests),
      );
      assert.equal(await fs.readFile(fixture.network, "utf8"), "");
      // The install fails on the missing variable, so the base falls back.
      assert.match(result.stderr, /base dependencies/u);
    },
  );
}

// A variable that is on the allowed list reaches the install, so the manager
// can read it. LANG routes through the auth key to the recording registry.
test(
  "a cold Yarn Berry base reads an allowed LANG variable in the install",
  { timeout: 120_000 },
  async (context) => {
    const secret = "allowed-lang-sentinel";
    const { fixture } = await attacked(
      berry,
      {
        env: { LANG: `en_US.${secret}` },
        authPlaceholder: "${LANG}",
        secret,
        mustLeak: true,
      },
      context,
    );
    assert.ok(
      carried(fixture.registry.requests, secret),
      JSON.stringify(fixture.registry.requests),
    );
  },
);

// Finding 2: a base `.yarnrc.yml` that names an environment file outside the
// repository injects nothing, so its values never reach the registry.
test(
  "a cold Yarn Berry base cannot inject an outside environment file",
  { timeout: 120_000 },
  async (context) => {
    const secret = "inject-secret-DO-NOT-LEAK";
    const { result, fixture } = await attacked(
      berry,
      { secret, mustLeak: false, inject: true },
      context,
    );
    assert.equal(result.code, 0, result.stderr);
    assert.ok(
      !carried(fixture.registry.requests, secret),
      JSON.stringify(fixture.registry.requests),
    );
    assert.equal(await fs.readFile(fixture.network, "utf8"), "");
    assert.match(result.stderr, /base dependencies/u);
  },
);
