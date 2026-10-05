import assert from "node:assert/strict";
import test from "node:test";

import { RenderMoveTargets } from "../src/server/render_moves.js";

test("accepted render moves are private to one runtime and clear when evidence is unavailable", () => {
  const targets = new RenderMoveTargets();
  const runtime = { capability: () => ({ generation: "one" }) };
  const changes = {
    pairing: {
      moves: [{ kind: "page" as const, path: "new", previousPath: "old" }],
      diagnostics: [],
    },
  };
  assert.equal(targets.read("one"), undefined);
  targets.accept(runtime, changes, "ready");
  assert.deepEqual(targets.read("one"), {
    generation: "one",
    moves: changes.pairing.moves,
  });
  assert.equal(targets.read("two"), undefined);
  targets.clear();
  assert.equal(targets.read("one"), undefined);
  targets.accept(runtime, changes, "ready");
  targets.accept(runtime, changes, "pending");
  assert.equal(targets.read("one"), undefined);
  targets.accept(runtime, changes, "ready");
  targets.accept(undefined, changes, "ready");
  assert.equal(targets.read("one"), undefined);
});
