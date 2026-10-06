import assert from "node:assert/strict";
import { mock } from "node:test";

const cases = [];
let selected;
let urlReady;
let statusReady;
let reads;
const done = new Error("both saved statuses checked");
const status = {
  async textContent() {
    assert.fail("a hidden or stale status must not be saved with textContent");
  },
  async innerText() {
    assert.ok(urlReady, "wait for the selected variant URL before the read");
    assert.ok(statusReady, "wait for final status before the read");
    reads++;
    if (reads === 2) throw done;
    return "Unmodified";
  },
};
const page = {
  async setViewportSize() {},
  async goto() {},
  getByLabel: () => ({ async selectOption() {} }),
  getByRole: () => ({
    getByRole: (_role, { name }) => ({
      async click() {
        selected = name.toLowerCase();
        urlReady = false;
        statusReady = false;
      },
    }),
  }),
  locator(selector) {
    assert.equal(selector, "[data-workspace-status]");
    return status;
  },
  frameLocator: () => ({ locator: () => "frame" }),
};
mock.module("@playwright/test", {
  namedExports: {
    test(name, run) {
      if (name.includes("design props")) cases.push({ name, run });
    },
    expect(target) {
      return {
        async toHaveURL(pattern) {
          assert.equal(target, page);
          assert.match(
            `/view/design/library/chrome/top-bar/${selected}/`,
            pattern,
          );
          urlReady = true;
        },
        async toHaveText(expected) {
          if (target === "frame") return;
          assert.equal(target, status);
          assert.ok(urlReady, "settle navigation before status");
          assert.ok(expected instanceof RegExp);
          assert.match("Changed", expected);
          assert.match("Unmodified", expected);
          assert.doesNotMatch("", expected);
          statusReady = true;
        },
      };
    },
  },
});
await import("../browser/design_library_runtime.spec.ts");
assert.equal(cases.length, 2);
for (const { name, run } of cases) {
  reads = 0;
  await assert.rejects(run({ page }), (error) => {
    assert.equal(error, done, name);
    return true;
  });
  assert.equal(reads, 2, name);
}
process.stdout.write(
  "Both viewport tests wait before both saved-status reads.\n",
);
