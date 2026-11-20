import { defineComponent } from "@mokly/mokly";

import { commentThreadInput } from "../../components/comment-thread";

const commentThread = defineComponent(commentThreadInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const CommentThread = commentThread.Component;
export default commentThread;
