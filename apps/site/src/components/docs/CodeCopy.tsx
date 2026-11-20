/**
 * The copy control every code panel on a documentation page carries. One
 * island places a control in each panel when the browser is idle and copies
 * that panel's own text, so the page holds no second copy of the source and
 * the reader always copies what is on screen.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SLOT = ".site-code-copy-slot";

function Copy({ panel }: { readonly panel: HTMLElement }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function write(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        panel.querySelector("pre")?.textContent ?? "",
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="site-code-copy"
      onClick={() => void write()}
      type="button"
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Place a copy control in every code panel of the rendered document. */
export default function CodeCopy() {
  const [slots, setSlots] = useState<readonly HTMLElement[]>([]);

  useEffect(() => {
    setSlots([...document.querySelectorAll<HTMLElement>(SLOT)]);
  }, []);

  return (
    <>
      {slots.map((slot, index) =>
        slot.parentElement?.parentElement
          ? createPortal(
              <Copy panel={slot.parentElement.parentElement} />,
              slot,
              String(index),
            )
          : undefined,
      )}
    </>
  );
}
