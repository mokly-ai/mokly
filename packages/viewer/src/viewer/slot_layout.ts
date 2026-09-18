/** Slots stay outside replaced islands; only their package-owned bounds change. */
export function slotLayout(root: HTMLElement, home: () => boolean) {
  const overlay = root.querySelector<HTMLElement>(
    '[data-mokly-slot="stageOverlay"]',
  )!;
  const empty = root.querySelector<HTMLElement>(
    '[data-mokly-slot="emptyState"]',
  )!;
  let observed: Element | null = null;
  const update = () => {
    empty.hidden = !home() || !empty.hasChildNodes();
    const main = root.querySelector<HTMLElement>("[data-mokly-view]")!;
    main.hidden = !empty.hidden;
    const stage = root.querySelector<HTMLElement>(
      "[data-workspace-preview], .mbk-flow, .mbk-stage-embed",
    );
    overlay.hidden = !stage;
    if (!stage) return;
    if (observed !== stage) {
      if (observed) resize.unobserve(observed);
      observed = stage;
      resize.observe(stage);
    }
    const bounds = stage.getBoundingClientRect();
    const parent = overlay.parentElement!.getBoundingClientRect();
    Object.assign(overlay.style, {
      top: `${bounds.top - parent.top}px`,
      left: `${bounds.left - parent.left}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    });
  };
  const resize = new ResizeObserver(update);
  resize.observe(root);
  return { update, dispose: () => resize.disconnect() };
}
