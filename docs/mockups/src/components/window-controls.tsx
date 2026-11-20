import "../../styles/illustrations/window-controls.css";

import { componentInput, componentMetadata } from "./metadata";

const focuses = ["focused", "unfocused"] as const;

/**
 * The close, minimize and zoom buttons that macOS draws over the start of the
 * Mac app's top bar. The app draws none of them, so this is illustration
 * material: decorative shapes hidden from assistive technology, coloured when
 * the window has focus and grey when it does not.
 */
export const windowControlsInput = componentInput({
  ...componentMetadata(
    "Window controls",
    "The native macOS window buttons over the start of the Mac app's top bar.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["focus"],
    properties: { focus: { enum: focuses } },
  },
  props: { focus: "focused" },
  controls: {
    focus: {
      kind: "select",
      options: focuses.map((value) => ({ label: value, value })),
    },
  },
  render: ({ focus }) => (
    <span
      className={"fo-window-controls fo-window-controls-" + focus}
      aria-hidden="true"
    >
      <i className="fo-window-close" />
      <i className="fo-window-minimize" />
      <i className="fo-window-zoom" />
    </span>
  ),
  variants: [
    { slug: "focused", title: "Focused", props: { focus: "focused" } },
    { slug: "unfocused", title: "Unfocused", props: { focus: "unfocused" } },
  ],
});
