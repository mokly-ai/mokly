/**
 * The Swipe control of the home demos island. The stage of the Browse
 * frame's depicted compare carries `data-home-swipe`. Once the island runs,
 * it marks the stage `ready`, and the reader's pointer works the divider:
 *
 * - A mouse or a pen that moves over the compared screens marks the stage
 *   `hover`, and the Browse demo's sheet pauses the sweep where it is. A
 *   scroll that brings the screens under a resting pointer moves no
 *   pointer, so the sweep plays on. The pointer's leave resumes it.
 * - A press of a mouse or a pen grabs the divider: the stage is `drag`, the
 *   divider jumps under the pointer and follows it until the release. A
 *   touch grabs it once it moves across the screens, and a tap puts it under
 *   the finger. A touch that moves up or down scrolls the page.
 * - A grab marks the stage `placed` and sets `--swipe-share`, the divider's
 *   share of the stage's width. The sweep then stops for good, and the
 *   divider rests where the reader leaves it until the page loads again.
 *
 * The control is a pointer-only part of a depiction: it takes no focus and
 * has no role. `home-island.ts` starts it on the home.
 */

/** The attribute that marks a Swipe stage. */
const STAGE = "data-home-swipe";

/** The attribute that holds a stage's state while the island runs it. */
const STATE = "data-home-swipe-state";

/** The attribute of a stage whose divider the reader has placed. */
const PLACED = "data-home-swipe-placed";

/** The custom property of the divider's share of the stage's width. */
const SHARE = "--swipe-share";

/** How far, in CSS pixels, a touch moves across before it grabs. */
const SLOP = 8;

/** A stage's state: no pointer, a pointer over it, or a grab. */
type SwipeState = "ready" | "hover" | "drag";

/** A press on a stage that holds, or can grab, the divider. */
interface Press {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  grabbed: boolean;
}

/**
 * The divider's share of the stage's width, in percent, for a pointer at
 * `clientX`: the pointer's place across the stage, kept within the stage.
 */
function swipeShare(clientX: number, stage: DOMRect): number {
  if (stage.width <= 0) return 50;
  const share = ((clientX - stage.left) / stage.width) * 100;
  return Math.min(100, Math.max(0, share));
}

/** Whether the pointer of `event` is over `stage`. */
function isOver(event: PointerEvent, stage: HTMLElement): boolean {
  const { bottom, left, right, top } = stage.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x >= left && x <= right && y >= top && y <= bottom;
}

/** Whether a touch has moved far enough across the stage to grab. */
function movesAcross(press: Press, event: PointerEvent): boolean {
  const across = Math.abs(event.clientX - press.clientX);
  return across >= SLOP && across > Math.abs(event.clientY - press.clientY);
}

/** Hand one Swipe stage to the reader's pointer. */
function controlStage(stage: HTMLElement): void {
  let state: SwipeState = "ready";
  let press: Press | null = null;

  const show = (next: SwipeState): void => {
    if (next === state) return;
    state = next;
    stage.setAttribute(STATE, next);
  };
  const place = (clientX: number): void => {
    const share = swipeShare(clientX, stage.getBoundingClientRect());
    stage.style.setProperty(SHARE, `${share}%`);
    stage.setAttribute(PLACED, "");
  };
  const grab = (event: PointerEvent, held: Press): void => {
    held.grabbed = true;
    stage.setPointerCapture(event.pointerId);
    place(event.clientX);
    show("drag");
  };

  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const { pointerId, clientX, clientY } = event;
    press = { pointerId, clientX, clientY, grabbed: false };
    if (event.pointerType === "touch") return;
    // The press grabs the divider, so it selects no text.
    event.preventDefault();
    grab(event, press);
  });
  stage.addEventListener("pointermove", (event) => {
    if (press?.pointerId === event.pointerId) {
      if (press.grabbed) place(event.clientX);
      else if (movesAcross(press, event)) grab(event, press);
      return;
    }
    if (event.pointerType !== "touch") show("hover");
  });
  stage.addEventListener("pointerup", (event) => {
    if (press?.pointerId !== event.pointerId) return;
    // A tap puts the divider under the finger.
    if (!press.grabbed) place(event.clientX);
    press = null;
    const hovers = event.pointerType !== "touch" && isOver(event, stage);
    show(hovers ? "hover" : "ready");
  });
  stage.addEventListener("pointercancel", (event) => {
    if (press?.pointerId !== event.pointerId) return;
    press = null;
    show("ready");
  });
  stage.addEventListener("pointerleave", (event) => {
    if (press === null && event.pointerType !== "touch") show("ready");
  });
  stage.setAttribute(STATE, state);
}

/** Hand each Swipe stage of the page to the reader's pointer. */
export function startSwipeControl(document: ParentNode): void {
  for (const stage of document.querySelectorAll<HTMLElement>(`[${STAGE}]`)) {
    controlStage(stage);
  }
}
