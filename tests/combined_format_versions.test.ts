import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import { parseReviewResult, parseStaticDelivery } from "@mokly/viewer/data";

import {
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";
import { readShellBootstrapEnvelope } from "../packages/viewer/dist/standalone/bootstrap_envelope.js";

function unsupported(schemaVersion: number) {
  return {
    schemaVersion,
    get entries(): never {
      throw new Error("read entries before version gate");
    },
    get screens(): never {
      throw new Error("read screens before version gate");
    },
    get catalogue(): never {
      throw new Error("read catalogue before version gate");
    },
    get canonicalPath(): never {
      throw new Error("read canonicalPath before version gate");
    },
  };
}

test("combined manifest gates reject both earlier v8 shapes before entries", () => {
  for (const earlier of [
    {
      schemaVersion: 8,
      entries: [{ id: "home", navPath: [] }],
      assetClosure: [],
      generatedFiles: [],
    },
    { schemaVersion: 8, entries: [{ path: "home" }], folders: [] },
  ]) {
    assert.throws(() => parseManifest(earlier), /schema version 10/);
    assert.throws(() => parseHistoricalManifest(earlier), {
      code: "baseline-incompatible-earlier",
    });
  }
});

test("current and historical manifest versions precede payload validation", () => {
  for (const version of [8, 9, 11]) {
    assert.throws(
      () => parseManifest(unsupported(version)),
      /schema version 10/,
    );
    assert.throws(
      () => parseHistoricalManifest(unsupported(version)),
      version < 10
        ? { code: "baseline-incompatible-earlier" }
        : /schema version 10/,
    );
  }
});

test("combined public formats reject parent versions before payload fields", async () => {
  for (const version of [4, 5]) {
    const earlier = JSON.parse(
      await fs.readFile(
        `docs/protocol/fixtures/catalogue-v${version}.json`,
        "utf8",
      ),
    );
    assert.throws(() => readCatalogue(earlier), {
      name: "MoklyVersionError",
      boundary: "catalogue",
    });
  }
  for (const version of [4, 5, 7])
    assert.throws(
      () => readCatalogue(unsupported(version)),
      /Unsupported Mokly catalogue version/,
    );
  for (const version of [4, 5, 6, 8])
    assert.throws(
      () => parseReviewResult(unsupported(version)),
      /unsupported schemaVersion/,
    );
  for (const version of [3, 4, 6])
    assert.deepEqual(parseStaticDelivery(unsupported(version)), {
      kind: "unsupported-version",
      version,
    });
  for (const version of [1, 3])
    assert.throws(
      () => readShellBootstrapEnvelope(unsupported(version)),
      /Unsupported Mokly bootstrap version/,
    );
});
