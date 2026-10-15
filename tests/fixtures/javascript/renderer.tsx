import type { RenderInput } from "@mokly/mokly";

import "./shared.css";

export default function render(input: RenderInput) {
  return {
    node: (
      <section
        data-entry={input.entry.path}
        data-title={input.entry.title}
        data-scheme={input.colorScheme}
      >
        {input.node}
      </section>
    ),
    resources: ["assets/banner.svg"],
  };
}
