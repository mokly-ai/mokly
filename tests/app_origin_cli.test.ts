import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArguments,
  validateInteractiveArguments,
} from "../dist/cli/arguments.js";

test("app origin is Serve-only and works when Live is off", () => {
  const appOrigin = "https://catalogue.example:8443";
  const parsed = parseArguments(["serve", "--app-origin", appOrigin]);
  assert.equal(parsed.appOrigin, appOrigin);
  assert.deepEqual(
    parseArguments(["serve", `--app-origin=${appOrigin}`]),
    parsed,
  );
  assert.doesNotThrow(() => validateInteractiveArguments(parsed, "off"));
  assert.doesNotThrow(() => validateInteractiveArguments(parsed, "serve"));
  assert.equal(
    parseArguments(["__serve-child", `--app-origin=${appOrigin}`]).appOrigin,
    appOrigin,
  );
  for (const command of ["build", "check", "export", "publish"])
    assert.throws(
      () =>
        parseArguments([
          command,
          ...(command === "export" ? ["--out=site"] : []),
          `--app-origin=${appOrigin}`,
        ]),
      /--app-origin belongs to serve/,
    );
});

test("app origin requires an exact canonical HTTP(S) origin", () => {
  for (const origin of [
    "http://catalogue.example",
    "https://catalogue.example",
    "http://localhost:4173",
    "https://catalogue.example:8443",
  ])
    assert.equal(
      parseArguments(["serve", `--app-origin=${origin}`]).appOrigin,
      origin,
    );
  for (const origin of [
    "",
    "null",
    "catalogue.example",
    "ftp://catalogue.example",
    "https://user:secret@catalogue.example",
    "https://catalogue.example/",
    "https://catalogue.example/path",
    "https://catalogue.example?",
    "https://catalogue.example#",
    "https://catalogue.example:443",
    "https://CATALOGUE.example",
    "https://catalogue.example:08443",
    " https://catalogue.example",
    "https://catalogue.example\n",
  ])
    assert.throws(
      () => parseArguments(["serve", `--app-origin=${origin}`]),
      { code: "cli-invalid" },
      origin,
    );
  for (const argv of [["--app-origin"], ["--app-origin", "--help"]])
    assert.throws(() => parseArguments(argv), /--app-origin requires a value/);
});

test("origin options reject wildcard hosts that CSP would broaden", () => {
  for (const option of ["--app-origin", "--interactive-origin"])
    for (const origin of [
      "https://*",
      "https://*.example",
      "http://catalogue.*.example:4173",
    ])
      assert.throws(
        () => parseArguments(["serve", `${option}=${origin}`]),
        /canonical HTTP\(S\) origin/,
      );
});
