/**
 * The parts of the page that move the Mac app's window: the elements that the
 * shared drag rule in `docs/mockups/styles/product/shared.css` names. Keep the
 * two lists the same.
 */
const dragAreas = [
  ".fo-package-slot",
  ".fo-top-bar",
  ".fo-stage-bar",
  ".fo-account-header",
  ".fo-layer-bar",
  ".fo-window-band",
].join(", ");

/** The mark of a covered area. The shared stylesheet turns its drag off. */
const coveredMark = "data-mkc-drag-covered";

/** The attribute of the cloud's element around the viewer package. */
const viewerHostMark = "data-mkc-viewer-host";

/**
 * The props of the cloud's element around the viewer package. A check finds
 * the package's parts inside that element, with no package selector.
 */
export const viewerHostProps = { [viewerHostMark]: "" } as const;

/** The class of the cloud's skip links. */
const skipLink = ".skip-link";

/**
 * The space between the points that a check tests, across an area and down
 * it. Every 24px control in an area holds a point, and a 48px bar has points
 * at two heights.
 */
const across = 16;
const down = 24;

/** The size of the part of the page that the window shows. */
interface Viewport {
  width: number;
  height: number;
}

/** The points of an area that a check tests, inside the viewport only. */
function* testPoints(
  box: DOMRect,
  viewport: Viewport,
): Generator<readonly [number, number]> {
  const left = Math.max(box.left, 0);
  const right = Math.min(box.right, viewport.width);
  const top = Math.max(box.top, 0);
  const bottom = Math.min(box.bottom, viewport.height);
  if (right <= left || bottom <= top) return;
  for (let y = top + Math.min(down, bottom - top) / 2; y < bottom; y += down) {
    for (
      let x = left + Math.min(across, right - left) / 2;
      x < right;
      x += across
    ) {
      yield [x, y];
    }
  }
}

/**
 * Whether the element at a point covers the area there. A cover is outside
 * the area, and it is a part that the viewer package draws or a cloud skip
 * link. A cloud dialog, sheet, menu or backdrop is no cover, so the area
 * still moves the window while one is open.
 */
function covers(
  found: Element | null,
  area: Element,
  hosts: readonly Element[],
): boolean {
  if (found === null || area.contains(found)) return false;
  if (found.closest(skipLink) !== null) return true;
  return hosts.some((host) => host !== found && host.contains(found));
}

/** Whether a cover is at one of the area's points. It stops at the first. */
function isCovered(
  area: Element,
  document: Document,
  hosts: readonly Element[],
  viewport: Viewport,
): boolean {
  for (const [x, y] of testPoints(area.getBoundingClientRect(), viewport)) {
    if (covers(document.elementFromPoint(x, y), area, hosts)) return true;
  }
  return false;
}

/**
 * One check: mark each covered drag area and unmark each other one. It reads
 * every area before it writes a mark, so a mark cannot make the page compute
 * its styles again between two reads.
 */
export function markCoveredAreas(document: Document): void {
  const { clientWidth, clientHeight } = document.documentElement;
  const viewport = { width: clientWidth, height: clientHeight };
  const hosts = [...document.querySelectorAll(`[${viewerHostMark}]`)];
  const areas = [...document.querySelectorAll(dragAreas)];
  const covered = areas.map((area) =>
    isCovered(area, document, hosts, viewport),
  );
  areas.forEach((area, index) => {
    if (area.hasAttribute(coveredMark) !== covered[index]) {
      area.toggleAttribute(coveredMark, covered[index]);
    }
  });
}

/** Unmark every area, so that every area moves the window again. */
export function unmarkAreas(document: Document): void {
  for (const area of document.querySelectorAll(`[${coveredMark}]`)) {
    area.removeAttribute(coveredMark);
  }
}

/**
 * Whether a scroll can move a cover over a drag area. A scroll of the page
 * moves all that is not fixed. An element clips what it scrolls to its box,
 * so its scroll matters only when its box meets an area.
 */
export function scrollMeetsArea(
  target: EventTarget | null,
  document: Document,
): boolean {
  if (!(target instanceof Element)) return true;
  const box = target.getBoundingClientRect();
  for (const area of document.querySelectorAll(dragAreas)) {
    const part = area.getBoundingClientRect();
    if (
      box.left < part.right &&
      part.left < box.right &&
      box.top < part.bottom &&
      part.top < box.bottom
    ) {
      return true;
    }
  }
  return false;
}
