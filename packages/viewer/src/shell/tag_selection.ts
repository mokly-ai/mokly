/** Apply a chip selection before returning focus to its own picker toggle. */
export function selectTag(
  target: HTMLElement,
  select: () => void,
  openDetailsPicker: boolean,
  afterSelect?: () => void,
): void {
  const toggle = openDetailsPicker
    ? target
        .closest("[data-mokly-shell]")
        ?.querySelector<HTMLButtonElement>("[data-mokly-tag-toggle]")
    : undefined;
  select();
  afterSelect?.();
  if (toggle) queueMicrotask(() => toggle.focus());
}
