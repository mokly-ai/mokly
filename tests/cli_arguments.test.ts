import assert from "node:assert/strict";
import test from "node:test";

import { parseArguments } from "../dist/cli/arguments.js";
import { redactCliSecrets } from "../dist/cli/secrets.js";

test("all value options accept assignment with the same validation as separate values", () => {
  for (const [command, option, value] of [
    ["serve", "--config", "tools/catalogue.config.ts"],
    ["serve", "--base", "origin/main"],
    ["serve", "--port", "0"],
    ["export", "--out", "site"],
    ["publish", "--endpoint", "https://receiver.invalid/upload?one=a=b"],
    ["publish", "--token", "synthetic-token=="],
    ["publish", "--repository", "github.com/team/catalogue"],
    ["publish", "--upload-concurrency", "4"],
    ["__serve-child", "--update-version", "2"],
  ] as const) {
    assert.deepEqual(
      parseArguments([command, `${option}=${value}`]),
      parseArguments([command, option, value]),
      option,
    );
  }
});

test("assigned values preserve leading dashes, spaces and every subsequent equals sign", () => {
  assert.deepEqual(
    parseArguments([
      "publish",
      "--config=-config directory/catalogue.ts",
      "--out=-site",
      "--token=-synthetic-token==",
      "--endpoint=https://receiver.invalid/upload?project=a=b",
      "--no-changes",
    ]),
    {
      command: "publish",
      help: false,
      version: false,
      config: "-config directory/catalogue.ts",
      out: "-site",
      token: "-synthetic-token==",
      endpoint: "https://receiver.invalid/upload?project=a=b",
      noChanges: true,
    },
  );
});

test("empty assignments and missing separate values fail without consuming the next option", () => {
  for (const option of [
    "--config",
    "--base",
    "--out",
    "--endpoint",
    "--token",
    "--repository",
    "--upload-concurrency",
    "--port",
    "--update-version",
  ]) {
    for (const suffix of [
      [`${option}=`, "a-value"],
      [option],
      [option, "--help"],
    ]) {
      assert.throws(
        () => parseArguments(["publish", ...suffix]),
        /cli-invalid.*requires a value/,
      );
    }
  }
  assert.throws(
    () => parseArguments(["publish", "--token", "-synthetic-token"]),
    /cli-invalid.*requires a value/,
  );
});

test("assignments cannot bypass boolean syntax, numeric validation or command restrictions", () => {
  for (const option of [
    "--help",
    "-h",
    "--version",
    "-v",
    "--watch",
    "--no-watch",
    "--no-changes",
    "--debug-timings",
    "--retained-runtime",
    "--strict-port",
    "--unknown",
  ])
    for (const value of ["", "true", "false"])
      assert.throws(
        () => parseArguments(["publish", `${option}=${value}`]),
        /cli-invalid.*unknown option/,
      );
  for (const argv of [
    ["serve", "--port=-1"],
    ["serve", "--port=65536"],
    ["build", "--port=1234"],
    ["build", "--out=site"],
    ["build", "--base=main"],
    ["serve", "--update-version=2"],
    ["__serve-child", "--update-version=0"],
    ["export", "--out=site", "--token=synthetic-token"],
    ["publish", "--no-changes", "--base=HEAD"],
    ["publish", "--upload-concurrency=0"],
    ["publish", "--upload-concurrency=33"],
    ["export", "--out=site", "--upload-concurrency=4"],
  ])
    assert.throws(() => parseArguments(argv), /cli-invalid/);
});

test("assigned bearer tokens are redacted in raw and URI-encoded diagnostics", () => {
  const token = "-synthetic/credential+padding==";
  const message = `${token} ${encodeURIComponent(token)} environment-token`;
  assert.equal(
    redactCliSecrets(message, ["publish", `--token=${token}`], {
      MOKLY_TOKEN: "environment-token",
    }),
    "[REDACTED] [REDACTED] [REDACTED]",
  );
});
