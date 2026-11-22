/**
 * The one way the site's modal dialogs, the menu, the docs tree sheet and
 * docs search, close on a press on the dimmed page where the browser does
 * not implement `closedby="any"`, such as Safari today. Each dialog keeps
 * `closedby="any"`, and where the browser implements it, this adds nothing.
 */

/** Whether a press on a modal dialog fell outside its box, on the backdrop. */
function onBackdrop(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/**
 * Close the dialog on a press on the dimmed page where the browser does not
 * implement `closedby="any"`. A press on the backdrop targets the dialog
 * itself, as a press on the dialog's own box does, so only a press outside
 * the box counts. As with `closedby`, the press must start and end there: a
 * drag that starts inside the dialog and ends on the dimmed page, such as a
 * text selection in a field, keeps it open. Answers the function that
 * removes the listeners.
 */
export function closeOnBackdrop(dialog: HTMLDialogElement): () => void {
  if ("closedBy" in HTMLDialogElement.prototype) return () => undefined;
  let pressed = false;
  const onPointerDown = (event: PointerEvent) => {
    pressed = onBackdrop(dialog, event);
  };
  const onClick = (event: MouseEvent) => {
    if (pressed && onBackdrop(dialog, event)) dialog.close();
    pressed = false;
  };
  dialog.addEventListener("pointerdown", onPointerDown);
  dialog.addEventListener("click", onClick);
  return () => {
    dialog.removeEventListener("pointerdown", onPointerDown);
    dialog.removeEventListener("click", onClick);
  };
}
