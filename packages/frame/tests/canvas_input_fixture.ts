import type { TestContext } from "node:test";

import { runtimeFixture } from "./probe_runtime_fixture.js";

export function canvasInputFixture(t: TestContext) {
  const fixture = runtimeFixture(t);
  const { doc, win } = fixture;
  const button = doc.createElement("button");
  doc.body.append(button);
  let focused = false;
  let focusVisible = false;
  let focusReads = 0;
  doc.hasFocus = () => {
    focusReads++;
    return focused;
  };
  Object.defineProperty(doc, "activeElement", { get: () => button });
  Object.defineProperty(button, "matches", {
    value: (selector: string) => selector === ":focus-visible" && focusVisible,
  });

  function dispatch(event: Event, target: EventTarget) {
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }
  return {
    ...fixture,
    button,
    focusReads: () => focusReads,
    focus(
      type: "focus" | "blur",
      isFocused: boolean,
      visible = false,
      target: EventTarget = win,
    ) {
      focused = isFocused;
      focusVisible = visible;
      return dispatch(new win.FocusEvent(type, { cancelable: true }), target);
    },
    wheel(init: WheelEventInit) {
      // Happy DOM's WheelEvent omits the mouse fields that browsers supply.
      return dispatch(
        Object.assign(
          new win.MouseEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ...init,
          }),
          { deltaMode: init.deltaMode ?? 0, deltaY: init.deltaY ?? 0 },
        ),
        button,
      );
    },
    gesture(
      type: "gesturestart" | "gesturechange" | "gestureend",
      scale: number,
      clientX = 10,
      clientY = 20,
    ) {
      return dispatch(
        Object.assign(
          new win.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
          }),
          { scale },
        ),
        button,
      );
    },
    key(init: KeyboardEventInit, target: EventTarget = button) {
      return dispatch(
        new win.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
        target,
      );
    },
  };
}
