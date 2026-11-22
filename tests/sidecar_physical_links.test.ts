import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ReuseEvidence } from "../packages/mokly/src/generated/sidecar/ReuseEvidence.js";
import {
  PhysicalInputReader,
  currentEvidence,
} from "../packages/mokly/src/sidecar/physical-input-reader.js";

import { nativeRoot, write } from "./helpers/native_resolution.js";

test("dangling link evidence requires its absent final target and rejects replacement or retargeting", async (context) => {
  const root = await nativeRoot(context);
  const candidate = path.join(root, "candidate.ts");
  const intermediate = path.join(root, "intermediate.ts");
  const target = path.join(root, "missing.ts");
  const other = path.join(root, "other.ts");
  await fs.symlink("./intermediate.ts", candidate, "file");
  await fs.symlink("./nested/../missing.ts", intermediate, "file");
  await fs.mkdir(path.join(root, "nested"));
  const evidence: ReuseEvidence = {
    complete: true,
    durable: false,
    inputs: {
      [candidate]: { kind: "link", target },
      [target]: { kind: "absent" },
    },
  };
  const marked = () =>
    new PhysicalInputReader().markedCurrent({
      ...evidence,
      complete: false,
      uncaptured: "serveEdit",
    });
  assert.equal(
    currentEvidence(evidence),
    true,
    "a dangling link with its absent lexical final target must match",
  );
  assert.equal(marked(), true);
  assert.equal(
    currentEvidence({
      ...evidence,
      inputs: { [candidate]: { kind: "link", target } },
    }),
    false,
    "a failed canonical path must not match without an adjacent absent entry",
  );
  assert.equal(
    currentEvidence({
      ...evidence,
      inputs: { [candidate]: { kind: "absent" } },
    }),
    false,
    "recorded absence must still use lstat and reject a dangling link",
  );
  await fs.unlink(intermediate);
  await fs.symlink("./other.ts", intermediate, "file");
  assert.equal(currentEvidence(evidence), false);
  assert.equal(marked(), false);
  await fs.unlink(intermediate);
  await fs.symlink("./missing.ts", intermediate, "file");
  assert.equal(currentEvidence(evidence), true);
  await write(target, "export {};");
  assert.equal(currentEvidence(evidence), false);
  await fs.unlink(target);
  await fs.unlink(candidate);
  await write(candidate, "export {};");
  assert.equal(currentEvidence(evidence), false);
  await assert.rejects(fs.lstat(other), { code: "ENOENT" });
});
