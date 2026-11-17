import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  packageArguments,
  packageArtifact,
  withSigningFiles,
} from "../../scripts/package.mjs";

test("the packaged smoke finds electron-builder's architecture-specific artifacts", () => {
  const files = [
    "Mokly-0.1.0-alpha.1-mac-x64.zip",
    "Mokly-0.1.0-alpha.1-mac-arm64.zip",
    "Mokly-0.1.0-alpha.1-linux-x86_64.AppImage",
    "Mokly-0.1.0-alpha.1-linux-amd64.deb",
  ];
  assert.equal(packageArtifact(files, "darwin"), files[1]);
  assert.equal(packageArtifact(files, "linux"), files[2]);
});

test("preview packages never publish and macOS uses only an ad-hoc signature", () => {
  for (const platform of ["linux", "darwin"]) {
    const args = packageArguments(platform, false);
    assert.equal(args[args.indexOf("--publish") + 1], "never");
    assert.ok(args.includes("--x64"));
    if (platform === "darwin") {
      assert.ok(args.includes("--arm64"));
      assert.ok(args.includes("--config.mac.identity=-"));
      assert.ok(args.includes("--config.mac.hardenedRuntime=false"));
      assert.ok(args.includes("--config.mac.notarize=false"));
    } else assert.ok(!args.some((arg) => arg.includes("mac.")));
  }
});

test("releases build before publishing and require the macOS Developer ID signature", () => {
  for (const platform of ["linux", "darwin"]) {
    const args = packageArguments(platform, true);
    assert.equal(args[args.indexOf("--publish") + 1], "never");
    assert.equal(
      args.includes("--config.forceCodeSigning=true"),
      platform === "darwin",
    );
    assert.ok(
      !args.some((arg) =>
        /identity=-|hardenedRuntime=false|notarize=false/.test(arg),
      ),
    );
  }
});

test("signing files are private and removed after success or failure", async () => {
  const environment = {
    CSC_LINK: Buffer.from("certificate fixture").toString("base64"),
    APPLE_API_KEY: "key fixture\nsecond line\n",
    CSC_KEY_PASSWORD: "password fixture",
    APPLE_API_KEY_ID: "key-id fixture",
    APPLE_API_ISSUER: "issuer fixture",
    GH_TOKEN: "token fixture",
  };
  for (const fail of [false, true]) {
    const paths: string[] = [];
    const run = withSigningFiles(environment, async (builder) => {
      paths.push(builder.CSC_LINK, builder.APPLE_API_KEY);
      assert.equal(
        await readFile(builder.CSC_LINK, "utf8"),
        "certificate fixture",
      );
      assert.equal(
        await readFile(builder.APPLE_API_KEY, "utf8"),
        environment.APPLE_API_KEY,
      );
      for (const path of paths)
        assert.equal((await stat(path)).mode & 0o777, 0o600);
      for (const key of [
        "CSC_KEY_PASSWORD",
        "APPLE_API_KEY_ID",
        "APPLE_API_ISSUER",
        "GH_TOKEN",
      ] as const)
        assert.equal(builder[key], environment[key]);
      if (fail) throw new Error("publisher fixture failure");
      return 0;
    });
    if (fail) await assert.rejects(run, /publisher fixture failure/);
    else assert.equal(await run, 0);
    for (const path of paths)
      await assert.rejects(access(path), { code: "ENOENT" });
  }
});
