import { defineComponent } from "@mokly/mokly";

import { optionsListInput } from "../../components/options-list";

const optionsList = defineComponent(optionsListInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const OptionsList = optionsList.Component;
export default optionsList;
