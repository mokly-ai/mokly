import assert from "node:assert/strict";
import test from "node:test";

import {
  auditCommandEnvironment,
  auditCommandInDirectory,
  npmAuditCommand,
} from "../scripts/verification/dependency-audit-command.mjs";

test("audit commands select their cwd with a relative explicit prefix", () => {
  const head = npmAuditCommand({
    nodeExecPath: "/node",
    cwd: "/repo",
    platform: "linux",
  });
  const base = auditCommandInDirectory(head, "/tmp/with spaces");
  assert.deepEqual(head.args, [
    "audit",
    "--json",
    "--audit-level=low",
    "--package-lock-only",
    "--include=prod",
    "--include=dev",
    "--include=optional",
    "--include=peer",
    "--prefix",
    ".",
  ]);
  assert.equal(base.cwd, "/tmp/with spaces");
  assert.deepEqual(base.args, head.args);
});

test("npm parent directory and workspace config cannot override the audit tree", () => {
  const env = {
    PATH: "/bin",
    npm_config_local_prefix: "/wrong",
    npm_config_prefix: "/wrong",
    npm_config_workspace: "viewer",
    npm_config_workspaces: "true",
    NPM_CONFIG_GLOBAL: "true",
    INIT_CWD: "/wrong",
    npm_config_registry: "https://registry.example.test",
    npm_config_userconfig: "/npm-config",
    REGISTRY_AUTH: "fixture-auth",
  };
  const cleaned = auditCommandEnvironment(env, "/tmp/audit");
  assert.deepEqual(cleaned, {
    PATH: "/bin",
    INIT_CWD: "/tmp/audit",
    npm_config_registry: env.npm_config_registry,
    npm_config_userconfig: "/npm-config",
    REGISTRY_AUTH: "fixture-auth",
  });
  assert.equal(env.INIT_CWD, "/wrong");
  const head = npmAuditCommand({
    nodeExecPath: "/node",
    cwd: "/repo",
    platform: "linux",
    env,
  });
  const base = auditCommandInDirectory(head, "/tmp/audit");
  assert.equal(base.env?.INIT_CWD, "/tmp/audit");
  assert.equal(base.env?.npm_config_registry, env.npm_config_registry);
});
