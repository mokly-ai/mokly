import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { REBUILD_DETAIL } from "../../parts/rebuild_status.js";
import { libraryMetadata } from "../metadata.js";
import { flag, text } from "../schemas.js";

import { RebuildNoticeView } from "./rebuild-notice.view.js";

const propSchema = {
  kind: "object",
  properties: {
    detail: text,
    open: flag,
  },
} as const;
export type RebuildNoticeProps = ComponentProps<typeof propSchema, []>;
export const rebuildNotice = defineComponent({
  ...libraryMetadata(
    "chrome",
    "rebuild-notice",
    "Update notice",
    "The full-width notice below the top bar when the latest saved changes could not be loaded, with the developer detail behind a disclosure.",
  ),
  propSchema,
  controls: {
    open: { kind: "boolean", label: "Details open" },
  },
  render: RebuildNoticeView,
  variants: [
    {
      slug: "collapsed",
      title: "Collapsed",
      props: { detail: REBUILD_DETAIL, open: false },
    },
    {
      slug: "details",
      title: "Details open",
      props: { detail: REBUILD_DETAIL, open: true },
    },
  ],
});
