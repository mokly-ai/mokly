import type { RenderInput, RenderResult } from "@mokly/mokly";

const absent = "__mokly_env_absent__";

export default function render(input: RenderInput): RenderResult {
  return {
    node: (
      <div
        data-renderer-token={process.env.MOKLY_TOKEN ?? absent}
        data-renderer-endpoint={process.env.MOKLY_ENDPOINT ?? absent}
        data-fixture={process.env.FIXTURE_ENVIRONMENT_VALUE ?? absent}
      >
        {input.node}
      </div>
    ),
    resources: [],
  };
}
