import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import {
  noViteProject,
  viteFiles,
  viteFixture,
} from "./fixtures/vite/support.js";
import { reviewFixture } from "./fixtures/vite_review.js";
import type { ReviewFixture } from "./fixtures/vite_review.js";
import { reportDuration } from "./helpers/durations.js";
import { startSidecar } from "./helpers/sidecar.js";

test("Vite graphs retain source digests, query files, and static then dynamic import order", async (context) => {
  await reportDuration(
    "Vite module graph",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const screen = path.join(fixture.root, "src/screen.mockup.tsx");
      const consumed =
        'export const early = () => import("./early.js");\n' +
        (await fs.readFile(screen, "utf8"));
      await fs.writeFile(screen, consumed);
      await fs.writeFile(
        path.join(fixture.root, "src/early.ts"),
        'export const early = "early dynamic import";\n',
      );
      const sidecar = startSidecar(context, fixture.root);
      await sidecar.call("hello");
      const result = await sidecar.call<BundleResult>("bundle", fixture.params);
      const source = result.modules.find(
        (module) => module.path === "src/screen.mockup.tsx",
      );
      assert.ok(source);
      assert.deepEqual(
        source.imports.filter((file) => !file.startsWith("node_modules/")),
        [
          "src/message.js",
          "src/mark.svg",
          "src/message.txt",
          "src/screen.css",
          "src/screen.module.css",
          "src/early.ts",
          "src/lazy.ts",
        ],
      );
      assert.equal(
        source.digest,
        createHash("sha256").update(consumed).digest("hex"),
      );
      const raw = result.modules.find(
        (module) => module.path === "src/message.txt",
      );
      assert.deepEqual(raw, {
        path: "src/message.txt",
        imports: [],
        digest: createHash("sha256").update("raw from Vite\n").digest("hex"),
      });
      assert.deepEqual(
        result.modules.filter((module) => module.path.includes("?")),
        [],
      );
      assert.deepEqual(result.compiled.reuseEvidence, {
        complete: false,
        durable: false,
        inputs: {},
      });
      assert.deepEqual(result.compiled.metadataDirectories[""], [
        ".env.development",
        "env.d.ts",
        "mokly.config.json",
        "node_modules",
        "package.json",
        "vite.config.ts",
      ]);
      assert.deepEqual(
        sidecar.operations.map(({ operation }) => operation),
        ["vite"],
      );
      await sidecar.call("shutdown");
    },
  );
});

test("a missing project Vite peer fails bundle with a named bundle-failed error", async (context) => {
  await reportDuration(
    "Missing Vite",
    (line) => context.diagnostic(line),
    async () => {
      const params = await noViteProject(context);
      const sidecar = startSidecar(context, params.sourceRoot);
      await sidecar.call("hello");
      await assert.rejects(sidecar.call("bundle", params), {
        code: "bundle-failed",
        message: /vite/,
      });
      await sidecar.call("shutdown");
    },
  );
});

test("Vite compilation leaves the project's files and cache directories unchanged", async (context) => {
  await reportDuration(
    "Vite writes",
    (line) => context.diagnostic(line),
    async () => {
      const { root, params } = await viteFixture(context);
      const before = await viteFiles(root);
      const sidecar = startSidecar(context, root);
      await sidecar.call("hello");
      await sidecar.call("bundle", params);
      await sidecar.call("shutdown");
      assert.deepEqual(await viteFiles(root), before);
    },
  );
});

test("Vite rejects a module outside selected roots with a logical diagnostic", async (context) => {
  await reportDuration(
    "Vite confinement",
    (line) => context.diagnostic(line),
    async () => {
      const { root, parent, params } = await viteFixture(context);
      await fs.writeFile(
        path.join(parent, "outside.js"),
        "export default 'secret';",
      );
      await fs.writeFile(
        path.join(root, "escape.mockup.js"),
        "import outside from '../outside.js'; export { outside };",
      );
      const sidecar = startSidecar(context, root);
      await sidecar.call("hello");
      await assert.rejects(
        sidecar.call("bundle", {
          ...params,
          entryFiles: ["escape.mockup.js"],
          renderer: null,
        }),
        (error: unknown) => {
          assert.ok(error instanceof Error && "code" in error);
          assert.equal(error.code, "bundle-failed");
          assert.match(error.message, /escape\.mockup\.js/);
          assert.match(error.message, /outside\.js/);
          assert.doesNotMatch(error.message, new RegExp(parent));
          return true;
        },
      );
      await sidecar.call("shutdown");
    },
  );
});

test("Vite evaluation names the throwing helper of the second entry", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write(
    "src/helper.ts",
    'throw import.meta.filename + " failed"; export {};',
  );
  await expectEvaluationFailure(
    fixture,
    'import "./helper.js";',
    "src/helper.ts: src/helper.ts failed",
  );
});

test("Vite evaluation names the dependency that throws during a native load", async (context) => {
  const fixture = await reviewFixture(context);
  const dependency = "src/node_modules/throwing-package";
  await fixture.write(
    `${dependency}/package.json`,
    '{"exports":"./index.mjs"}',
  );
  await fixture.write(
    `${dependency}/index.mjs`,
    'throw new Error("native load failed");',
  );
  const { compiled } = await expectEvaluationFailure(
    fixture,
    'import "throwing-package";',
    `${dependency}/index.mjs: native load failed`,
  );
  assert.ok(
    compiled.vite?.modules.some(
      ({ result }) =>
        "externalize" in result &&
        result.externalize.endsWith(`/${dependency}/index.mjs`),
    ),
  );
});

test("Vite evaluation ignores id and plugin fields on a thrown object", async (context) => {
  const fixture = await reviewFixture(context);
  await expectEvaluationFailure(
    fixture,
    `throw Object.freeze(Object.assign(new Error("author error"), {
      id: "users",
      plugin: "author plugin",
    }));`,
    "src/second.mockup.ts: author error",
  );
});

test("Vite evaluation keeps the version when the runner fails before any module runs", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("src/review.mockup.ts", "export const ready = true;");
  const bundle = await fixture.compile();
  const generation = "without-module-runner";
  await fixture.sidecar.call("restoreGeneration", {
    ...bundle,
    generation,
    params: fixture.params,
    compiled: {
      ...bundle.compiled,
      peers: { ...bundle.compiled.peers, "vite/module-runner": null },
    },
  });
  await assert.rejects(fixture.sidecar.call("describe", { generation }), {
    code: "bundle-failed",
    message:
      /^Vite evaluation: could not resolve vite\/module-runner under the selected dependency policy \(Vite [^;]+; tested range [^)]+\)$/,
  });
  await fixture.sidecar.call("shutdown");
});

async function expectEvaluationFailure(
  fixture: ReviewFixture,
  code: string,
  message: string,
) {
  await fixture.write("src/review.mockup.ts", "export const first = true;");
  await fixture.write(
    "src/second.mockup.ts",
    `${code}\nexport const second = true;`,
  );
  fixture.params.entryFiles.push("src/second.mockup.ts");
  const bundle = await fixture.compile();
  const { generation } = bundle;
  await assert.rejects(fixture.sidecar.call("describe", { generation }), {
    code: "bundle-failed",
    message,
  });
  await fixture.sidecar.call("shutdown");
  return bundle;
}
