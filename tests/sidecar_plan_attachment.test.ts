import assert from "node:assert/strict";
import test from "node:test";

import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../packages/mokly/src/generated/sidecar/ReuseEvidence.js";
import { candidateDirectories } from "../packages/mokly/src/sidecar/plan-candidate-directories.js";

test("late candidate attachment overflow keeps every original path and no partial names", () => {
  const plan: ResolutionPlan = {
    paths: ["/entry.ts", "/value.ts"],
    imports: [],
  };
  const evidence: ReuseEvidence = {
    complete: true,
    durable: true,
    inputs: {
      "/one": { kind: "directory", entries: [] },
      "/two": { kind: "directory", entries: [] },
    },
  };
  let bytes = 0;
  let refused: string | undefined;
  const reserve = (charge: number) => {
    if (bytes + charge > 100) return false;
    bytes += charge;
    return true;
  };
  const attached = candidateDirectories(plan, evidence, {
    names: new Map([
      ["/one", new Set(["value.ts"])],
      ["/two", new Set(["value.ts"])],
    ]),
    blocked: new Set(),
    selected: new Set(),
    canonical: (directory) => directory,
    retain: (value, container) => {
      const fits = reserve(
        Buffer.byteLength(JSON.stringify(value)) + container,
      );
      if (!fits) refused = value;
      return fits;
    },
    reserve,
  });
  assert.equal(refused, "/two", "the second appended path reaches the bound");
  assert.deepEqual(plan, { paths: ["/entry.ts", "/value.ts"], imports: [] });
  assert.equal(attached, plan);
});

test("unlisted canonical directories add no merge or selected-target charge and keep exact plan bytes", () => {
  const plan: ResolutionPlan = {
    paths: ["/entry.ts", "/value.ts"],
    imports: [],
  };
  const retained: Array<[string, number]> = [];
  const reserved: number[] = [];
  const attached = candidateDirectories(
    plan,
    {
      complete: true,
      durable: true,
      inputs: {
        "/listed": {
          kind: "directory",
          entries: [{ name: "value.ts", kind: "file", target: null }],
        },
        "/unlisted": { kind: "filePath" },
      },
    },
    {
      names: new Map([
        ["/listed", new Set(["value.ts"])],
        ["/alias", new Set(["omitted.ts"])],
      ]),
      blocked: new Set(["/alias"]),
      selected: new Set(["/alias/native.ts"]),
      canonical: (directory) =>
        directory === "/alias" ? "/unlisted" : directory,
      retain: (value, container) => {
        retained.push([value, container]);
        return true;
      },
      reserve: (bytes) => {
        reserved.push(bytes);
        return true;
      },
    },
  );
  assert.deepEqual(retained, [
    ["/listed", 4],
    ["value.ts", 1],
    ["value.ts", 1],
    ["/listed", 9],
  ]);
  assert.deepEqual(reserved, [18, 12]);
  assert.equal(
    JSON.stringify(attached),
    JSON.stringify({
      paths: ["/entry.ts", "/value.ts", "/listed"],
      imports: [],
      candidates: [[2, ["value.ts"]]],
    }),
  );
});
