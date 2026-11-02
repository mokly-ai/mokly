/** Apply a chip selection before returning focus to its own picker toggle. */
export function selectTag(
  toggle: HTMLButtonElement | null | undefined,
  select: () => void,
  openDetailsPicker: boolean,
): void {
  select();
  if (openDetailsPicker && toggle) queueMicrotask(() => toggle.focus());
}
