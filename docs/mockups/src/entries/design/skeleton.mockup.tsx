import { defineComponent } from "@mokly/mokly";

import { skeletonInput } from "../../components/skeleton";

const skeleton = defineComponent(skeletonInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Skeleton = skeleton.Component;
export default skeleton;
