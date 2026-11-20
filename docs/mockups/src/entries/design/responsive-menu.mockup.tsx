import { defineComponent } from "@mokly/mokly";

import { responsiveMenuInput } from "../../components/responsive-menu";

const responsiveMenu = defineComponent(responsiveMenuInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const ResponsiveMenu = responsiveMenu.Component;
export default responsiveMenu;
