/** Accessible desktop divider and mobile sheet sizing, scoped to one workspace. */
export function installInspectorResize(
  root: HTMLElement,
  signal: AbortSignal,
): () => void {
  const win = root.ownerDocument.defaultView!;
  const inspector = root.querySelector<HTMLElement>(
    "[data-workspace-inspector]",
  )!;
  const divider = root.querySelector<HTMLElement>("[data-inspector-resize]")!;
  const grab = root.querySelector<HTMLButtonElement>("[data-inspector-size]")!;
  const panes = root.querySelector<HTMLElement>(".mbk-workspace-panes")!;
  let height = 260;
  const narrow = () => win.matchMedia("(max-width: 56.25rem)").matches;
  const bounds = () => ({
    min: Math.min(160, panes.clientHeight - 100),
    max: Math.max(46, panes.clientHeight - 100),
  });
  const clamp = () => {
    const { min, max } = bounds();
    height = Math.min(max, Math.max(Math.max(46, min), height));
    inspector.style.setProperty("--inspector-height", `${height}px`);
    divider.setAttribute("aria-valuemin", String(Math.max(46, min)));
    divider.setAttribute("aria-valuemax", String(max));
    divider.setAttribute("aria-valuenow", String(Math.round(height)));
  };
  const expand = (value: boolean) => {
    inspector.dataset["expanded"] = String(value);
    grab.setAttribute("aria-expanded", String(value));
    grab.setAttribute(
      "aria-label",
      value ? "Make inspector compact" : "Expand inspector",
    );
  };
  let drag:
    { pointer: number; y: number; height: number; moved: boolean } | undefined;
  let suppressClick = false;
  const begin = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    drag = {
      pointer: event.pointerId,
      y: event.clientY,
      height: inspector.getBoundingClientRect().height,
      moved: false,
    };
    target.setPointerCapture(event.pointerId);
    if (!narrow()) event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const delta = drag.y - event.clientY;
    drag.moved ||= Math.abs(delta) > 5;
    if (narrow())
      inspector.style.height = `${Math.min(panes.clientHeight - 36, Math.max(190, drag.height + delta))}px`;
    else {
      height = drag.height + delta;
      clamp();
    }
  };
  const end = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (narrow() && drag.moved) expand(drag.y - event.clientY > 0);
    suppressClick = drag.moved;
    inspector.style.removeProperty("height");
    drag = undefined;
  };
  for (const handle of [divider, grab]) {
    handle.addEventListener("pointerdown", begin, { signal });
    handle.addEventListener("pointermove", move, { signal });
    handle.addEventListener("pointerup", end, { signal });
    handle.addEventListener("pointercancel", end, { signal });
  }
  grab.addEventListener(
    "click",
    () => {
      if (!suppressClick) expand(inspector.dataset["expanded"] !== "true");
      suppressClick = false;
    },
    { signal },
  );
  divider.addEventListener(
    "keydown",
    (event) => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      height =
        event.key === "Home"
          ? bounds().min
          : event.key === "End"
            ? bounds().max
            : height + (event.key === "ArrowUp" ? 20 : -20);
      clamp();
    },
    { signal },
  );
  const observer = new ResizeObserver(clamp);
  observer.observe(panes);
  signal.addEventListener("abort", () => observer.disconnect(), { once: true });
  clamp();
  return clamp;
}
