import assert from "node:assert/strict";
import test from "node:test";

import { noisySidecar } from "./helpers/sidecar_diagnostics.js";

for (const verb of ["build", "serve"] as const)
  test(
    `${verb} drains several MiB of sidecar stderr in bounded pieces and reaps its children`,
    {
      timeout: 120_000,
      skip: verb === "serve" && process.platform === "win32",
    },
    async (context) => {
      const running = await noisySidecar(context, verb);
      if (verb === "serve") {
        await running.ready();
        assert.deepEqual(await running.completion(), {
          written: "yes",
          tail: null,
          exit: null,
        });
        running.child.kill("SIGINT");
      }
      const result = await running.result;
      assert.deepEqual(await running.completion(), {
        written: "yes",
        tail: verb === "serve" ? "yes" : null,
        exit: "0",
      });
      assert.equal(result.code, 0, result.stderr.slice(-2000));
      assert.equal(result.signal, null);
      const pieces = result.stderr.split("\n").filter(Boolean);
      assert.ok(pieces.length > 0);
      for (const piece of pieces) {
        assert.ok(
          piece.length <= 65_536,
          `oversized diagnostic: ${piece.length}`,
        );
        assert.match(piece, /^(L+|R+|S+|T+)$/u);
      }
      assert.equal(
        pieces
          .filter((piece) => piece[0] === "L")
          .reduce((sum, piece) => sum + piece.length, 0),
        40 * 65_537,
      );
      assert.equal(
        pieces
          .filter((piece) => piece[0] === "R")
          .reduce((sum, piece) => sum + piece.length, 0),
        2 * 1024 * 1024 + 1,
      );
      for (const [marker, expected] of [
        ["S", 65_537],
        ["T", 17],
      ] as const)
        assert.equal(
          pieces
            .filter((piece) => piece[0] === marker)
            .reduce((sum, piece) => sum + piece.length, 0),
          verb === "serve" ? expected : 0,
        );
      await running.assertStopped();
    },
  );
