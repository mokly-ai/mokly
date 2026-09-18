/** Desktop navigation split-panel resizing shared by catalogue views. */

/** Attach pointer, keyboard, viewport, and persistence behavior to the nav. */
export function initializeNavigationResize(
  doc: Document,
  win: Window & typeof globalThis,
): () => void {
  const nav = doc.querySelector<HTMLElement>(".mbk-nav");
  const handle = nav?.querySelector<HTMLElement>("[data-mokly-nav-resize]");
  if (!nav || !handle || handle.dataset["resizeInitialized"] === "true") {
    return () => {};
  }

  const numericAttribute = (name: string): number | undefined => {
    const value = handle.getAttribute(name);
    if (value === null || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const minimum = numericAttribute("aria-valuemin");
  const initial = numericAttribute("aria-valuenow");
  const maximum = numericAttribute("aria-valuemax");
  if (
    minimum === undefined ||
    initial === undefined ||
    maximum === undefined ||
    minimum > initial ||
    initial > maximum
  ) {
    return () => {};
  }

  const controller = new win.AbortController();
  const signal = controller.signal;
  const storageKey = "mokly:navigation-width:v1";
  let storage: Storage | undefined;
  try {
    storage = win.localStorage;
  } catch {
    storage = undefined;
  }
  let storedWidth: number | undefined;
  try {
    const stored = storage?.getItem(storageKey);
    if (stored !== null && stored !== undefined) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) storedWidth = parsed;
    }
  } catch {
    storage = undefined;
  }

  const viewportMaximum = (): number =>
    Math.max(minimum, Math.min(maximum, Math.floor(win.innerWidth / 2)));
  const applyWidth = (candidate: number): number => {
    const upper = viewportMaximum();
    const width = Math.round(Math.max(minimum, Math.min(upper, candidate)));
    nav.style.setProperty("--mbk-nav-width", `${width}px`);
    handle.setAttribute("aria-valuemax", String(upper));
    handle.setAttribute("aria-valuenow", String(width));
    handle.setAttribute("aria-valuetext", `${width} pixels`);
    return width;
  };
  const persist = (width: number): void => {
    try {
      storage?.setItem(storageKey, String(width));
    } catch {
      storage = undefined;
    }
  };

  let width = applyWidth(storedWidth ?? initial);
  let activePointer: number | undefined;
  let pointerStart = 0;
  let widthStart = width;
  const finishPointerResize = (): void => {
    const pointer = activePointer;
    if (pointer === undefined) return;
    activePointer = undefined;
    doc.body.classList.remove("mbk-nav-resizing");
    if (handle.hasPointerCapture(pointer))
      handle.releasePointerCapture(pointer);
    persist(width);
  };

  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      activePointer = event.pointerId;
      pointerStart = event.clientX;
      widthStart = nav.getBoundingClientRect().width;
      handle.setPointerCapture(event.pointerId);
      doc.body.classList.add("mbk-nav-resizing");
    },
    { signal },
  );
  handle.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId !== activePointer) return;
      width = applyWidth(widthStart + event.clientX - pointerStart);
    },
    { signal },
  );
  handle.addEventListener(
    "pointerup",
    (event) => {
      if (event.pointerId === activePointer) finishPointerResize();
    },
    { signal },
  );
  handle.addEventListener(
    "pointercancel",
    (event) => {
      if (event.pointerId === activePointer) finishPointerResize();
    },
    { signal },
  );
  handle.addEventListener(
    "lostpointercapture",
    (event) => {
      if (event.pointerId === activePointer) finishPointerResize();
    },
    { signal },
  );
  handle.addEventListener(
    "keydown",
    (event) => {
      let candidate: number;
      if (event.key === "ArrowLeft") candidate = width - 16;
      else if (event.key === "ArrowRight") candidate = width + 16;
      else if (event.key === "Home") candidate = minimum;
      else if (event.key === "End") candidate = viewportMaximum();
      else return;
      event.preventDefault();
      width = applyWidth(candidate);
      persist(width);
    },
    { signal },
  );
  handle.addEventListener(
    "dblclick",
    () => {
      width = applyWidth(initial);
      persist(width);
    },
    { signal },
  );
  win.addEventListener("blur", finishPointerResize, { signal });
  win.addEventListener(
    "resize",
    () => {
      width = applyWidth(width);
    },
    { signal },
  );

  handle.dataset["resizeInitialized"] = "true";
  nav.dataset["resizeReady"] = "";
  return () => {
    controller.abort();
    finishPointerResize();
    delete handle.dataset["resizeInitialized"];
    delete nav.dataset["resizeReady"];
  };
}
