/**
 * The copy control every code panel on a documentation page carries. One
 * island places a control in each panel when the browser is idle, or a
 * second after the page reaches it at the latest, and copies that panel's own
 * text, so the page holds no second copy of the source and the reader always
 * copies what is on screen.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CanvasIcon } from "./CanvasIcon.js";

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
      // The block's text is its source, newlines included; the stylesheet
      // draws the prompts and the line numbers, so they are never copied.
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
      <CanvasIcon name="copy" size={14} />
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/**
 * Place a copy control in the head of every code panel of the rendered
 * document, after the head's copy slot, so the control is a sibling of the
 * tabs, the path and the language, which the shared sheet places it after.
 */
export default function CodeCopy() {
  const [heads, setHeads] = useState<readonly HTMLElement[]>([]);

  useEffect(() => {
    setHeads(
      [...document.querySelectorAll<HTMLElement>(SLOT)].flatMap((slot) =>
        slot.parentElement ? [slot.parentElement] : [],
      ),
    );
  }, []);

  return (
    <>
      {heads.map((head, index) =>
        head.parentElement
          ? createPortal(
              <Copy panel={head.parentElement} />,
              head,
              String(index),
            )
          : undefined,
      )}
    </>
  );
}
