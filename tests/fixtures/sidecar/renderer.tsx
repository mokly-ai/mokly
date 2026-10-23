import type { RenderInput, RenderResult } from "@mokly/mokly";

export default function render(input: RenderInput): RenderResult {
  return {
    node: (
      <div data-renderer={input.entry.path} data-axis={input.viewport}>
        {input.node}
      </div>
    ),
    resources: ["font.woff2"],
  };
}
