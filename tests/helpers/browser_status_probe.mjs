import assert from "node:assert/strict";
import { mock } from "node:test";

const cases = [];
const operations = [];
const done = new Error("all final status checks observed");
const status = { kind: "status" };
let ready;
let statuses;
const page = {
  async setViewportSize() {},
  async goto() {
    operations.push("navigate");
    ready = false;
  },
  async waitForFunction() {
    ready = true;
  },
  getByLabel: () => ({
    async selectOption() {},
    async check() {},
    async uncheck() {},
    async fill() {},
  }),
  getByRole: (_role, options) => ({
    async click() {
      if (options?.name === "Reset") operations.push("reset");
    },
  }),
  locator: () => status,
  frameLocator: () => ({
    locator: () => ({
      first() {
        return this;
      },
    }),
  }),
};
const test = (name, run) => {
  if (name.includes("design props")) cases.push({ name, run });
};
let setup;
test.beforeAll = (run) => {
  setup = run;
};
test.setTimeout = () => {};
test.afterAll = () => {};
mock.module("../../dist/server/serve.js", {
  namedExports: {
    serve() {
      return { url: "http://probe.invalid", async close() {} };
    },
  },
});
mock.module("../helpers/example_baseline.js", {
  namedExports: {
    createCommittedExampleBaseline() {
      return {};
    },
  },
});
mock.module("../browser/workspace_actions.js", {
  namedExports: {
    async chooseViewport() {
      ready = true;
    },
    async chooseVariant() {
      operations.push("variant");
      ready = true;
    },
  },
});
mock.module("node:fs/promises", {
  defaultExport: {
    async mkdtemp() {
      return "/tmp/probe";
    },
    async readFile() {
      return "authored bytes";
    },
  },
});
mock.module("../helpers/watched_catalogue.js", {
  namedExports: { async waitForInitialChanges() {} },
});
mock.module("@playwright/test", {
  namedExports: {
    test,
    expect(target) {
      return {
        async toHaveText(expected) {
          if (target !== status) return;
          assert.equal(
            ready,
            true,
            "wait for navigation before checking status",
          );
          assert.equal(expected, "Unmodified");
          operations.push("status");
          statuses++;
          if (statuses === 3) throw done;
        },
        async toBeVisible() {},
        async toHaveCSS() {},
        async toHaveCount() {},
      };
    },
  },
});
await import("../browser/design_library_runtime.spec.ts");
assert.equal(cases.length, 2);
await setup();
for (const { name, run } of cases) {
  operations.length = 0;
  statuses = 0;
  await assert.rejects(run({ page }), (error) => {
    assert.equal(error, done, name);
    return true;
  });
  assert.deepEqual(operations, [
    "navigate",
    "status",
    "reset",
    "status",
    "variant",
    "status",
  ]);
}
process.stdout.write(
  "Both viewport tests await explicit final status after navigation, reset and variant selection.\n",
);
