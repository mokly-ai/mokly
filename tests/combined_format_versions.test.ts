import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { MoklyVersionError, readCatalogue } from "@mokly/viewer";
import { parseReviewResult, parseStaticDelivery } from "@mokly/viewer/data";

import {
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";
import { requestComparison } from "../packages/viewer/dist/shell/comparison_request.js";
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
  for (const version of [1, 2, 3, 4, 5, 6, 8])
    assert.throws(
      () => parseReviewResult(unsupported(version)),
      reviewVersionError(version),
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

function reviewVersionError(version: number) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof MoklyVersionError);
    assert.equal(error.code, "unsupported-mokly-version");
    assert.equal(error.boundary, "review");
    assert.equal(error.version, version);
    assert.equal(error.supported, 7);
    assert.equal(
      error.message,
      `Unsupported Mokly review version ${version}; this viewer supports version 7.`,
    );
    return true;
  };
}

async function releasedReview() {
  const result = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/released-review-v6.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(result.schemaVersion, 6);
  return result;
}

test("released review v6 returns a typed unsupported-version error", async () => {
  const released = await releasedReview();
  assert.throws(() => parseReviewResult(released), reviewVersionError(6));
});

test("browser comparison requests preserve the released review v6 version error", async () => {
  const released = await releasedReview();
  const baseUrl = "https://example.invalid/";
  const endpoint = `mokly-viewer/diffs/generations/${"a".repeat(64)}/review.json`;
  const response = new Response(JSON.stringify(released));
  Object.defineProperty(response, "url", { value: baseUrl + endpoint });
  await assert.rejects(
    requestComparison(
      {
        baseUrl,
        delivery: () => ({ kind: "pinned", comparisonUrl: endpoint }),
        fetch: async () => response,
      },
      { id: "action" },
      false,
      new AbortController().signal,
    ),
    reviewVersionError(6),
  );
});

test("malformed review versions and current data keep one plain invalid-review prefix", () => {
  for (const schemaVersion of [undefined, null, "6", 7]) {
    assert.throws(
      () => parseReviewResult({ schemaVersion }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.constructor, Error);
        assert.equal("code" in error, false);
        assert.equal(
          error.message,
          schemaVersion === 7
            ? "[mokly/review] required field is missing"
            : "[mokly/review] unsupported schemaVersion",
        );
        return true;
      },
    );
  }
});
