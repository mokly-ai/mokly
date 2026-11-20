import { defineComponent } from "@mokly/mokly";

import { contentListInput } from "../../components/content-list";

const contentList = defineComponent(contentListInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const ContentList = contentList.Component;
export default contentList;
