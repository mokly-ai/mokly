import type { RenderInput } from "@mokly/mokly";

import { theme } from "./theme.js";

export default function render(input: RenderInput) {
  return <section data-theme={theme}>{input.node}</section>;
}
