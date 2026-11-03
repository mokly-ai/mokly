import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { validatePackageManifest } from "../scripts/release/manifest.mjs";
import { checkViewerPackage } from "../scripts/release/viewer.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  modelPackageReport,
  viewerPackageReport,
} from "./helpers/release_fixture.js";

const archive = (await import(
  pathToFileURL(
    path.resolve(import.meta.dirname, "../scripts/release/archive.mjs"),
  ).href
)) as {
  validatePackageReport(
    report: ReturnType<typeof viewerPackageReport>,
    name?: string,
  ): void;
  inspectRuntimeLicenses(root: string): Promise<void>;
};

for (const { name, createReport, required } of [
  {
    name: "@mokly/viewer",
    createReport: viewerPackageReport,
    required: [
      "dist/index.js",
      "dist/index.d.ts",
      "dist/browser.js",
      "dist/data.js",
      "dist/styles.css",
      "LICENSE",
    ],
  },
  {
    name: "@mokly/model",
    createReport: modelPackageReport,
    required: ["dist/index.js", "dist/index.d.ts", "LICENSE"],
  },
]) {
  test(`${name} archive requires its public runtime, declarations, and licence`, () => {
    const report = createReport();
    archive.validatePackageReport(report, name);
    for (const file of required)
      assert.throws(
        () =>
          archive.validatePackageReport(
            {
              ...report,
              files: report.files.filter((item) => item.path !== file),
            },
            name,
          ),
        /missing/,
      );
    assert.throws(
      () =>
        archive.validatePackageReport(
          {
            ...report,
            files: [...report.files, { path: "src/private.ts", size: 1 }],
          },
          name,
        ),
      /non-allowlisted/,
    );
    assert.throws(() =>
      archive.validatePackageReport({ ...report, name: "@mokly/mokly" }, name),
    );
  });
}

test("runtime licence inspection resolves workspace links and rejects missing licences", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-release-licence-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const lock = {
    packages: {
      "": { private: true },
      "packages/viewer": { license: "MIT" },
      "node_modules/@mokly/viewer": { link: true, resolved: "packages/viewer" },
    },
  };
  const file = path.join(root, "package-lock.json");
  await fs.writeFile(file, JSON.stringify(lock));
  await archive.inspectRuntimeLicenses(root);
  for (const license of ["UNLICENSED", "", undefined]) {
    if (license === undefined)
      Reflect.deleteProperty(lock.packages["packages/viewer"], "license");
    else lock.packages["packages/viewer"].license = license;
    await fs.writeFile(file, JSON.stringify(lock));
    await assert.rejects(
      archive.inspectRuntimeLicenses(root),
      /licenses must be declared/,
    );
  }
});

test("the viewer and model manifests enforce their public release boundaries", async () => {
  for (const relative of ["packages/viewer", "packages/model"]) {
    const original = JSON.parse(
      await fs.readFile(
        path.join(repositoryRoot, relative, "package.json"),
        "utf8",
      ),
    );
    validatePackageManifest(original, original.name);
    const invalid: Array<(value: typeof original) => void> = [
      (value) => {
        value.name = "@other/viewer";
      },
      (value) => {
        value.version = "01.2.3";
      },
      (value) => {
        value.license = "UNLICENSED";
      },
      (value) => {
        delete value.exports["."];
      },
      (value) => {
        value.files.push("src");
      },
      (value) => {
        value.dependencies = { other: "workspace:*" };
      },
      (value) => {
        value.dependencies = { other: "file:../other" };
      },
    ];
    if (relative === "packages/viewer")
      invalid.push(
        (value) => {
          delete value.peerDependencies["react-dom"];
        },
        (value) => {
          delete value.dependencies["@mokly/ui"];
        },
        (value) => {
          value.dependencies["@mokly/ui"] = "^0.16.1";
        },
        (value) => {
          delete value.dependencies["@mokly/model"];
        },
        (value) => {
          value.dependencies["@mokly/model"] = "^0.18.0";
        },
      );
    else
      invalid.push(
        (value) => {
          value.optionalDependencies = { "@mokly/mokly": "0.18.0" };
        },
        (value) => {
          value.dependencies = { "@mokly/frame": "0.18.0" };
        },
        (value) => {
          value.peerDependencies = { "@mokly/viewer": "0.18.0" };
        },
        (value) => {
          value.exports["./private"] = value.exports["."];
        },
      );
    for (const mutate of invalid) {
      const changed = structuredClone(original);
      mutate(changed);
      assert.throws(() => validatePackageManifest(changed, original.name));
    }
  }
});

test("the built viewer source and dry-run exports obey the release contract", async () => {
  await checkViewerPackage(repositoryRoot);
});
