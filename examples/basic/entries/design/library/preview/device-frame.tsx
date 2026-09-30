import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { flag, optionalText, text } from "../schemas.js";

import { DeviceFrameView } from "./device-frame.view.js";

const propSchema = {
  kind: "object",
  properties: {
    device: { schema: { kind: "enum", values: ["phone", "browser"] } },
    label: optionalText,
    dark: flag,
    lightOnly: flag,
    small: flag,
    expandable: flag,
    address: text,
  },
} as const;
const slots = ["children"] as const;
export type DeviceFrameProps = ComponentProps<typeof propSchema, typeof slots>;
const sample = {
  device: "phone",
  label: "Mobile",
  dark: false,
  lightOnly: false,
  small: true,
  expandable: true,
  address: "example.test/welcome",
  children: <MiniWelcome compact />,
} as const;
export const deviceFrame = defineComponent({
  ...libraryMetadata(
    "preview",
    "device-frame",
    "Device frame",
    "Phone and browser chrome around caller-owned screen content.",
  ),
  propSchema,
  slots,
  controls: {
    device: {
      kind: "select",
      label: "Device",
      options: [
        { label: "Phone", value: "phone" },
        { label: "Browser", value: "browser" },
      ],
    },
    dark: { kind: "boolean", label: "Dark preview" },
    small: { kind: "boolean", label: "Compact frame" },
    address: { kind: "text", label: "Address" },
  },
  render: DeviceFrameView,
  variants: [
    { id: "design-ui-device-frame-phone", title: "Phone", props: sample },
    {
      id: "design-ui-device-frame-browser",
      title: "Browser",
      props: {
        ...sample,
        device: "browser",
        label: "Desktop",
        children: <MiniWelcome />,
      },
    },
    {
      id: "design-ui-device-frame-dark",
      title: "Dark preview",
      props: { ...sample, dark: true },
    },
    {
      id: "design-ui-device-frame-light-only",
      title: "Light only",
      props: { ...sample, lightOnly: true },
    },
  ],
});
