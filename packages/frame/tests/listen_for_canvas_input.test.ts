import assert from "node:assert/strict";
import test from "node:test";

import {
  listenForCanvasInput,
  type CanvasInputEvent,
} from "../src/internal.js";

import { canvasInputFixture } from "./canvas_input_fixture.js";

test("standalone canvas input reports only canvas events without usage", (t) => {
  const fixture = canvasInputFixture(t);
  fixture.runtime.__dispose();
  const events: CanvasInputEvent[] = [];
  t.after(
    listenForCanvasInput(
      fixture.doc,
      (event) => events.push(event),
      fixture.environment,
    ),
  );
  fixture.flush();
  assert.deepEqual(events.splice(0), [{ type: "canvas-blur" }]);
  fixture.focus("focus", true, true);
  assert.equal(
    fixture.wheel({ ctrlKey: true, deltaY: -45, clientX: 23, clientY: 12 }),
    true,
  );
  assert.equal(fixture.key({ key: "+" }), false);
  fixture.point("pointermove");
  fixture.point("click");
  fixture.doc.dispatchEvent(new fixture.win.Event("scroll"));
  fixture.flush();
  assert.deepEqual(events, [
    { type: "canvas-key", key: "zoom-in" },
    { type: "canvas-wheel", deltaY: -45, deltaMode: 0, x: 23, y: 12 },
    { type: "canvas-focus", visible: true },
  ]);
});

for (const until of ["cleanup", "pagehide"] as const) {
  test(`standalone canvas input stops on ${until} without emitting or preventing`, (t) => {
    const fixture = canvasInputFixture(t);
    fixture.runtime.__dispose();
    const events: CanvasInputEvent[] = [];
    const cleanup = listenForCanvasInput(
      fixture.doc,
      (event) => events.push(event),
      fixture.environment,
    );
    t.after(cleanup);
    fixture.focus("focus", true, false);
    fixture.wheel({ metaKey: true, deltaY: 20 });
    if (until === "pagehide")
      fixture.win.dispatchEvent(new fixture.win.Event("pagehide"));
    else {
      cleanup();
      cleanup();
    }
    assert.equal(fixture.frames.size, 0);
    assert.equal(fixture.wheel({ ctrlKey: true, deltaY: -20 }), false);
    assert.equal(fixture.key({ key: "-" }), false);
    fixture.flush();
    assert.deepEqual(events, []);
  });
}
