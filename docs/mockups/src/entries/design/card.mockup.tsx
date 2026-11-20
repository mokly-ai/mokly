import { defineComponent } from "@mokly/mokly";

import { cardInput } from "../../components/card";

const card = defineComponent(cardInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Card = card.Component;
export default card;
