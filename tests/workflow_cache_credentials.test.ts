import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  mainCacheCondition,
  readCacheWorkflow,
  trustedCacheEnvironment,
} from "./helpers/turbo_ci.js";
import type { CacheWorkflow } from "./helpers/turbo_ci.js";
import { cacheCredentialFindings } from "./helpers/workflow_cache_credentials.js";

async function forbiddenNames(): Promise<string[]> {
  const source = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/ci-remote-cache-access.md"),
    "utf8",
  );
  const section =
    source
      .split("## Forbidden Repository Secret Aliases")[1]
      ?.split("\n## ")[0] ?? "";
  const names = [...section.matchAll(/^\| `([A-Z0-9_]+)`\s*\|/gmu)].map(
    (match) => match[1]!,
  );
  assert.ok(names.includes("CLOUDFLARE_API_TOKEN"));
  assert.ok(names.includes("CLOUDFLARE_R2_API_TOKEN"));
  assert.ok(names.includes("TURBO_CACHE_TOKEN"));
  return names;
}

test("every workflow keeps Workers/R2 and trusted cache credentials in their matching main environments", async () => {
  const forbidden = await forbiddenNames();
  const names = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  ).filter((name) => /\.ya?ml$/u.test(name));
  for (const name of names)
    assert.deepEqual(
      cacheCredentialFindings(await readCacheWorkflow(name), forbidden),
      [],
      name,
    );
});

test("the credential rule rejects environment leaks, PR exposure and forbidden aliases", async () => {
  const forbidden = await forbiddenNames();
  const safe: CacheWorkflow = {
    on: { push: {}, pull_request: {} },
    jobs: {
      prepare: {
        environment: trustedCacheEnvironment,
        steps: [
          {
            if: mainCacheCondition,
            env: {
              CACHE_TOKEN: "${{ secrets.TURBO_CACHE_TRUSTED_WRITE_TOKEN }}",
            },
          },
        ],
      },
    },
  };
  assert.deepEqual(cacheCredentialFindings(safe, forbidden), []);
  const outside = structuredClone(safe);
  delete outside.jobs.prepare!.environment;
  assert.ok(
    cacheCredentialFindings(outside, forbidden).some((finding) =>
      finding.includes("requires turbo-cache-trusted"),
    ),
  );
  outside.jobs.prepare!.steps[0]!.env = {
    CACHE_TOKEN: "${{ secrets.turbo_cache_trusted_write_token }}",
  };
  assert.ok(
    cacheCredentialFindings(outside, forbidden).some((finding) =>
      finding.includes("requires turbo-cache-trusted"),
    ),
  );
  const pr = structuredClone(safe);
  delete pr.jobs.prepare!.steps[0]!.if;
  assert.ok(
    cacheCredentialFindings(pr, forbidden).some((finding) =>
      finding.includes("pull request"),
    ),
  );
  for (const triggers of [
    "pull_request",
    ["push", "pull_request"],
    ["pull_request_target"],
  ]) {
    pr.on = triggers;
    assert.ok(
      cacheCredentialFindings(pr, forbidden).some((finding) =>
        finding.includes("pull request"),
      ),
    );
  }
  const deploy = structuredClone(safe);
  for (const name of [
    "CLOUDFLARE_WORKERS_API_TOKEN",
    "cloudflare_workers_api_token",
  ]) {
    deploy.jobs.prepare!.steps[0]!.env = {
      TOKEN: `\${{ secrets.${name} }}`,
    };
    assert.ok(
      cacheCredentialFindings(deploy, forbidden).some((finding) =>
        finding.includes("requires turbo-cache-deploy"),
      ),
    );
  }
  for (const alias of forbidden) {
    const legacy = structuredClone(safe);
    legacy.env = { TOKEN: `\${{ secrets.${alias} }}` };
    assert.ok(
      cacheCredentialFindings(legacy, forbidden).some((finding) =>
        finding.includes("Forbidden repository secret alias"),
      ),
    );
    legacy.env = { TOKEN: `\${{ secrets['${alias}'] }}` };
    assert.ok(cacheCredentialFindings(legacy, forbidden).length > 0);
    legacy.env = { TOKEN: `\${{ secrets.${alias.toLowerCase()} }}` };
    assert.ok(cacheCredentialFindings(legacy, forbidden).length > 0);
    legacy.env = { TOKEN: `\${{ secrets['${alias.toLowerCase()}'] }}` };
    assert.ok(cacheCredentialFindings(legacy, forbidden).length > 0);
  }
});
