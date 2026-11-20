import { defineComponent } from "@mokly/mokly";

import { textareaInput } from "../../components/textarea";

const textarea = defineComponent(textareaInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Textarea = textarea.Component;
export default textarea;
