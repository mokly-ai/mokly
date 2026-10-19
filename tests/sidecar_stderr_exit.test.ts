import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { noisyFixture } from "./helpers/sidecar_noise.js";

for (const verb of ["build", "serve"] as const)
  test(
    `${verb} sidecar shutdown preserves its final stderr tail and exits normally`,
    { timeout: 120_000 },
    async (context) => {
      const { root, packageRoot } = await noisyFixture(context, verb, false);
      const sidecar = startSidecar(
        context,
        root,
        process.env,
        path.join(packageRoot, "dist/sidecar.js"),
      );
      const closed = once(sidecar.child, "close");
      await sidecar.call("hello");
      await sidecar.call(
        "processCss",
        cssParams({
          sourceRoot: root,
          postcss: "postcss.mjs",
          text: "p { color: red }",
        }),
      );
      const read = (file: string) =>
        fs.readFile(path.join(root, ".context", file), "utf8");
      assert.equal(await read("stderr-complete"), "yes");
      await assert.rejects(read("stderr-tail-complete"), { code: "ENOENT" });
      await assert.rejects(read("sidecar-exit"), { code: "ENOENT" });
      assert.equal(await sidecar.call("shutdown"), null);
      assert.deepEqual(await closed, [0, null]);
      assert.equal(await read("stderr-complete"), "yes");
      assert.equal(await read("sidecar-exit"), "0");
      if (verb === "serve")
        assert.equal(await read("stderr-tail-complete"), "yes");
      else
        await assert.rejects(read("stderr-tail-complete"), { code: "ENOENT" });
      assert.equal(
        sidecar.stderr(),
        ("L".repeat(65_537) + "\n").repeat(40) +
          "R".repeat(2 * 1024 * 1024 + 1) +
          (verb === "serve"
            ? "\n" + "S".repeat(65_537) + "\n" + "T".repeat(17)
            : ""),
      );
      const pids = (await read("pids")).trim().split("\n").map(Number);
      assert.ok(new Set(pids).size >= 2);
      for (const pid of pids)
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    },
  );
