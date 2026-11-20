import { defineComponent } from "@mokly/mokly";

import { tableInput } from "../../components/table";

const table = defineComponent(tableInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Table = table.Component;
export default table;
