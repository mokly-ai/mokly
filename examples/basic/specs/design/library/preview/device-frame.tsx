import { defineComponent } from "@mokly/mokly";

import { MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { flag, text, type LibraryProps } from "../schemas.js";

import { DeviceFrameView } from "./device-frame.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["device", "dark", "lightOnly", "small", "expandable", "address"],
  properties: {
    device: { enum: ["phone", "browser"] },
    label: text,
    dark: flag,
    lightOnly: flag,
    small: flag,
    expandable: flag,
    address: text,
  },
} as const;
const slots = ["children"] as const;
export type DeviceFrameProps = LibraryProps<typeof propSchema, typeof slots>;
const sample = {
  device: "phone",
  label: "Mobile",
  dark: false,
  lightOnly: false,
  small: true,
  expandable: true,
  address: "example.test/welcome",
} as const;
const sampleSlots = { children: <MiniWelcome compact /> };
export const deviceFrame = defineComponent({
  ...libraryMetadata(
    "preview",
    "device-frame",
    "Device frame",
    "Phone and browser chrome around caller-owned screen content.",
  ),
  propSchema,
  props: sample,
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
    { slug: "phone", title: "Phone", props: sample, slots: sampleSlots },
    {
      slug: "browser",
      title: "Browser",
      props: { ...sample, device: "browser", label: "Desktop" },
      slots: { children: <MiniWelcome /> },
    },
    {
      slug: "dark",
      title: "Dark preview",
      props: { ...sample, dark: true },
      slots: sampleSlots,
    },
    {
      slug: "light-only",
      title: "Light only",
      props: { ...sample, lightOnly: true },
      slots: sampleSlots,
    },
  ],
});
