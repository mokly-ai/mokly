import { defineComponent } from "@mokly/mokly";

import { pageFrameInput } from "../../components/page-frame";

const pageFrame = defineComponent(pageFrameInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const PageFrame = pageFrame.Component;
export default pageFrame;
