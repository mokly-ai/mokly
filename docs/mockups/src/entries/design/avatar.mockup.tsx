import { defineComponent } from "@mokly/mokly";

import { avatarInput } from "../../components/avatar";

const avatar = defineComponent(avatarInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Avatar = avatar.Component;
export default avatar;
