import type { RenderInput } from "@mokly/mokly";
export default (input: RenderInput) => (
  <div data-path={input.entry.path} data-title={input.entry.title}>
    {input.node}
  </div>
);
