/**
 * The release in view, for the changelog island. The release in view is the
 * last shown frame whose top has passed the reading line, a little below the
 * place where a jump lands a frame, or the first shown frame while none has.
 * At the end of the page, the frame that the address names is in view when
 * it is in the window, so a jump to one of the last releases marks it. The
 * frame takes the selection and its size tag, and its frame label turns
 * green; its Version history row is current and kept in sight inside the
 * panel; the timeline's playhead and keyframe stand on it. Nothing moves by
 * animation, so reduced motion changes nothing.
 */

/** How far below the landing place of a jump the reading line sits. */
const READING_LINE = 32;

/** The release in view, as the island asks for it. */
export interface ReleaseView {
  /** The frame of the release in view, and whether the reader is inside it. */
  readonly inView: () => {
    readonly frame: HTMLElement | undefined;
    readonly passed: boolean;
  };
  /** Find the release in view again in the next animation frame. */
  readonly queue: () => void;
}

/** The element that a fragment names, if the page holds it. */
export function fragmentTarget(hash: string): HTMLElement | null {
  if (hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function pixels(value: string): number {
  const length = Number.parseFloat(value);
  return Number.isFinite(length) ? length : 0;
}

/**
 * Follow the release in view among the frames that `shown` gives, in page
 * order, as the page scrolls, resizes and opens or closes a disclosure.
 */
export function followReleaseInView(
  frames: readonly HTMLElement[],
  shown: () => readonly HTMLElement[],
): ReleaseView {
  const selection = document.querySelector<HTMLElement>(
    ".site-release > .site-sel",
  );
  const list = document.querySelector<HTMLElement>(
    ".site-release-index .site-panel-body",
  );
  const rows = [
    ...document.querySelectorAll<HTMLAnchorElement>(".site-release-index-link"),
  ];
  const keys = [
    ...document.querySelectorAll<HTMLElement>(
      ".site-changelog-keys > .site-changelog-key[data-release]",
    ),
  ];
  const playhead = document.querySelector<HTMLElement>(
    ".site-changelog-playhead",
  );
  let current = selection?.closest<HTMLElement>(".site-release") ?? undefined;
  let line = 0;

  const inView: ReleaseView["inView"] = () => {
    const showing = shown();
    let frame = showing[0];
    let passed = false;
    for (const candidate of showing) {
      if (candidate.getBoundingClientRect().top > line) break;
      frame = candidate;
      passed = true;
    }
    const root = document.documentElement;
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
      const named = fragmentTarget(window.location.hash)?.closest<HTMLElement>(
        ".site-release",
      );
      const box = named?.getBoundingClientRect();
      if (
        named &&
        box &&
        showing.includes(named) &&
        box.top < window.innerHeight
      )
        return { frame: named, passed: true };
    }
    return { frame, passed };
  };

  /** Keep a Version history row in sight inside the panel's list. */
  const reveal = (row: HTMLElement): void => {
    if (list === null || list.clientHeight === 0) return;
    const box = list.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    if (at.top >= box.top && at.bottom <= box.bottom) return;
    list.scrollTop += at.top - box.top - (box.height - at.height) / 2;
  };

  const mark = (frame: HTMLElement): void => {
    if (frame === current) return;
    current = frame;
    if (selection !== null) {
      frame.append(selection);
      const size = selection.querySelector(".site-sel-size");
      if (size !== null) size.textContent = frame.dataset["notes"] ?? "";
    }
    for (const other of frames)
      other
        .querySelector(":scope > .site-frame-name")
        ?.classList.toggle("site-frame-name--selected", other === frame);
    for (const row of rows) {
      const on = row.hash === `#${frame.id}`;
      row.classList.toggle("site-panel-row--current", on);
      row.classList.toggle("site-release-index-link--current", on);
      if (on) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
      if (on) reveal(row);
    }
    for (const key of keys) {
      const on = key.dataset["release"] === frame.id;
      key.classList.toggle("site-changelog-key--current", on);
      if (!on || playhead === null) continue;
      playhead.style.left = key.style.left;
      const label = playhead.querySelector("b");
      if (label !== null)
        label.textContent = `v${key.dataset["version"] ?? ""}`;
    }
  };

  const update = (): void => {
    const { frame } = inView();
    if (frame !== undefined) mark(frame);
  };

  let queued = false;
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };

  // A jump lands a frame at the root's scroll padding, which clears the tool
  // bar, plus the frame's own scroll margin.
  const measure = (): void => {
    const first = frames[0];
    line =
      pixels(getComputedStyle(document.documentElement).scrollPaddingTop) +
      (first === undefined
        ? 0
        : pixels(getComputedStyle(first).scrollMarginTop)) +
      READING_LINE;
  };

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    queue();
  });
  document.addEventListener("toggle", queue, true);
  void document.fonts.ready.then(queue);
  measure();
  update();
  return { inView, queue };
}
