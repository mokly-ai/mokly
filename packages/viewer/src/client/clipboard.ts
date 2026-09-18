/** Copy user-selected catalogue text, including older browser fallbacks. */
export function copyText(doc: Document, text: string): void {
  const clipboard = doc.defaultView?.navigator.clipboard;
  if (clipboard) {
    void clipboard.writeText(text).catch(() => undefined);
    return;
  }
  const area = doc.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  doc.body.appendChild(area);
  area.select();
  doc.execCommand("copy");
  area.remove();
}
