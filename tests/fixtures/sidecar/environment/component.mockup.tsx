import { defineComponent } from "@mokly/mokly";

const absent = "__mokly_env_absent__";

export const environment = defineComponent({
  path: "components/environment",
  element: "environment-test",
  title: "Environment",
  description: "Environment isolation fixture.",
  relatedDocs: [],
  propSchema: { type: "object", additionalProperties: false } as const,
  props: {},
  slots: [],
  render: () => (
    <section
      data-component-token={process.env.MOKLY_TOKEN ?? absent}
      data-component-endpoint={process.env.MOKLY_ENDPOINT ?? absent}
      data-fixture={process.env.FIXTURE_ENVIRONMENT_VALUE ?? absent}
    >
      Environment
    </section>
  ),
});
