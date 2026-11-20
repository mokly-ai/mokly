import { defineComponent } from "@mokly/mokly";

import { MiniAction } from "../../parts/mini_action.js";
import { MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { enumOptions, text, type LibraryProps } from "../schemas.js";

import { CanvasFrameView } from "./canvas-frame.view.js";

const length = { type: "integer", minimum: 1, maximum: 4000 } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "scheme", "label", "width", "height", "zoom"],
  properties: {
    kind: { enum: ["desktop", "mobile", "component", "document"] },
    scheme: { enum: ["light", "dark"] },
    label: text,
    entry: text,
    width: length,
    height: length,
    zoom: { type: "number", minimum: 0.05, maximum: 4 },
  },
} as const;
const slots = ["children", "overlay"] as const;
export type CanvasFrameProps = LibraryProps<typeof propSchema, typeof slots>;

const desktop = {
  kind: "desktop",
  scheme: "light",
  label: "Desktop · Light",
  width: 1280,
  height: 800,
  zoom: 0.25,
} as const;

export const canvasFrame = defineComponent({
  ...libraryMetadata(
    "canvas",
    "canvas-frame",
    "Canvas frame",
    "One view of an entry on the canvas: a bare frame with its label and size, scaled by the zoom.",
  ),
  propSchema,
  props: desktop,
  slots,
  controls: {
    label: { kind: "text", label: "Label" },
    scheme: {
      kind: "select",
      label: "Scheme",
      options: enumOptions(propSchema.properties.scheme),
    },
    zoom: {
      kind: "number",
      label: "Zoom",
      minimum: 0.05,
      maximum: 4,
      step: 0.01,
    },
  },
  render: CanvasFrameView,
  variants: [
    {
      slug: "desktop-light",
      title: "Desktop · Light",
      props: desktop,
      slots: { children: <MiniWelcome inert /> },
    },
    {
      slug: "mobile-dark",
      title: "Mobile · Dark",
      props: {
        kind: "mobile",
        scheme: "dark",
        label: "Mobile · Dark",
        entry: "welcome",
        width: 390,
        height: 844,
        zoom: 0.4,
      },
      slots: { children: <MiniWelcome compact inert /> },
    },
    {
      slug: "component",
      title: "Component",
      props: {
        kind: "component",
        scheme: "light",
        label: "Default · Light",
        width: 320,
        height: 132,
        zoom: 1,
      },
      slots: { children: <MiniAction variant="default" /> },
    },
    {
      slug: "document",
      title: "Reading frame",
      props: {
        kind: "document",
        scheme: "light",
        label: "payment-terms.md",
        width: 720,
        height: 480,
        zoom: 0.45,
      },
      slots: {
        children: (
          <div className="mbk-shot">
            <div className="mbk-shot-pad">
              <h2>Payment terms</h2>
              <p>
                When an invoice is due, and what a customer sees once it is
                late.
              </p>
            </div>
          </div>
        ),
      },
    },
  ],
});
