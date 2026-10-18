import assert from "node:assert/strict";
import test from "node:test";

import { completed } from "./helpers/mokly_serve.js";
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
        const url = await running.ready();
        const { index } = await completed(url, context.signal, "home");
        assert.equal(index.changesStatus, "unavailable");
        await running.gitFailure();
        running.child.kill("SIGINT");
      }
      const result = await running.result;
      assert.deepEqual(await running.completion(), {
        written: "yes",
        exit: "0",
      });
      assert.equal(result.code, 0, result.stderr.slice(-2000));
      assert.equal(result.signal, null);
      const pieces = result.stderr.split("\n").filter(Boolean);
      assert.ok(pieces.length > 0);
      const isGitFailure = (line: string) =>
        line.startsWith("[mokly/git-failed]");
      assert.equal(
        pieces.filter(isGitFailure).length,
        verb === "serve" ? 1 : 0,
      );
      for (const piece of pieces) {
        assert.ok(
          piece.length <= 65_536,
          `oversized diagnostic: ${piece.length}`,
        );
        if (!isGitFailure(piece)) assert.match(piece, /^(L+|R+)$/u);
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
      await running.assertStopped();
    },
  );
