import assert from "node:assert/strict";
import test from "node:test";

import { selectTag } from "../src/shell/tag_selection.js";

for (const open of [true, false]) {
  test(`Details tag selection preserves local focus ownership: picker open=${open}`, (context) => {
    const calls: string[] = [];
    const queued: Array<() => void> = [];
    context.mock.method(globalThis, "queueMicrotask", (callback: () => void) =>
      queued.push(callback),
    );
    const target = {
      closest(selector: string) {
        assert.equal(selector, "[data-mokly-shell]");
        calls.push("find shell");
        return {
          querySelector(selector: string) {
            assert.equal(selector, "[data-mokly-tag-toggle]");
            return { focus: () => calls.push("focus local toggle") };
          },
        };
      },
    } as unknown as HTMLElement;
    let pickerOpen = open;
    selectTag(
      target,
      () => {
        pickerOpen = false;
        calls.push("select tag");
      },
      pickerOpen,
      () => calls.push("after selection"),
    );
    assert.equal(pickerOpen, false);
    assert.deepEqual(calls, [
      ...(open ? ["find shell"] : []),
      "select tag",
      "after selection",
    ]);
    assert.equal(queued.length, open ? 1 : 0);
    for (const callback of queued) callback();
    assert.deepEqual(calls, [
      ...(open ? ["find shell"] : []),
      "select tag",
      "after selection",
      ...(open ? ["focus local toggle"] : []),
    ]);
  });
}
