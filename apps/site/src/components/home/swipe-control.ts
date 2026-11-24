/**
 * The Swipe control of the home demos island. The stage of the Browse
 * frame's depicted compare carries `data-home-swipe`. Once the island runs,
 * it marks the stage `ready`, and a reader's pointer takes the divider: a
 * mouse or a pen that moves over the compared screens, or a press of any
 * pointer, a tap included, marks the stage `held` and puts the divider under
 * the pointer. Under `held` the Browse demo's sheet stops the sweep, and the
 * divider and the branch screen's clip follow `--swipe-share`, the
 * divider's share of the stage's width. The divider stays where the pointer
 * leaves it. A touch that moves without a press leaves the page to scroll.
 * The control is a pointer-only part of a depiction: it takes no focus and
 * has no role. `home-island.ts` starts it on the home.
 */

/** The attribute that marks a Swipe stage. */
const STAGE = "data-home-swipe";

/** The attribute that holds a stage's state while the island runs it. */
const STATE = "data-home-swipe-state";

/** The custom property of the divider's share of the stage's width. */
const SHARE = "--swipe-share";

/** A pointer event over a stage, as the control reads it. */
export interface SwipePointer {
  readonly clientX: number;
  readonly pointerType: string;
}

/** A Swipe stage. */
export interface SwipeStage {
  readonly style: { setProperty(name: string, value: string): void };
  addEventListener(
    type: "pointerdown" | "pointermove",
    listener: (event: SwipePointer) => void,
  ): void;
  getBoundingClientRect(): { readonly left: number; readonly width: number };
  setAttribute(name: string, value: string): void;
}

/** The page, as the control reads it. */
export interface SwipePage {
  querySelectorAll(selectors: string): Iterable<SwipeStage>;
}

/**
 * The divider's share of the stage's width, in percent, for a pointer at
 * `clientX`: the pointer's place across the stage, kept within the stage.
 */
function swipeShare(
  clientX: number,
  stage: { readonly left: number; readonly width: number },
): number {
  if (stage.width <= 0) return 50;
  const share = ((clientX - stage.left) / stage.width) * 100;
  return Math.min(100, Math.max(0, share));
}

/** Hand each Swipe stage of the page to the reader's pointer. */
export function startSwipeControl(document: SwipePage): void {
  for (const stage of document.querySelectorAll(`[${STAGE}]`)) {
    const follow = (event: SwipePointer): void => {
      const share = swipeShare(event.clientX, stage.getBoundingClientRect());
      stage.style.setProperty(SHARE, `${share}%`);
      stage.setAttribute(STATE, "held");
    };
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch") follow(event);
    });
    stage.addEventListener("pointerdown", follow);
    stage.setAttribute(STATE, "ready");
  }
}
