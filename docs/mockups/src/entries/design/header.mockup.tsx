import { defineComponent } from "@mokly/mokly";

import { headerInput } from "../../components/header";

const header = defineComponent(headerInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Header = header.Component;
export default header;
