import {
  defineComponent,
  resolveInstance,
  reviewMaterialKey,
  type ComponentControl,
  type ComponentInstanceRecord,
  type ComponentProps,
  type ComponentSourceLocation,
  type DataPropSchema,
  type InstanceResolution,
  type RenderResult,
} from "@mokly/mokly";

const schema = {
  kind: "object",
  properties: {
    label: { schema: { kind: "string" } },
    amount: { schema: { kind: "number" }, optional: true },
  },
} as const;
const component = defineComponent({
  id: "typed-component",
  title: "Typed component",
  description: "Packed declaration inference.",
  route: "components/typed.html",
  dependencies: [],
  relatedDocs: [],
  propSchema: schema,
  slots: ["children"],
  controls: { label: { kind: "text" }, amount: { kind: "number", minimum: 0 } },
  render: (props, context) => (
    <div data-viewport={context.viewport}>
      {props.label}
      {props.amount}
      {props.children}
    </div>
  ),
  variants: [
    {
      id: "default",
      title: "Default",
      props: { label: "Continue", children: <strong>Slot</strong> },
    },
  ],
});
const valid = <component.Component label="Valid" moklyInstance="first" />;
// @ts-expect-error The declared label remains required.
const missing = <component.Component amount={1} />;
// @ts-expect-error Numeric props reject strings in consumer code.
const wrong = <component.Component label="Invalid" amount="one" />;
const props: ComponentProps<typeof schema, readonly ["children"]> = {
  label: "Typed",
};
const data: DataPropSchema = schema;
const control: ComponentControl = { kind: "number", step: 1 };
const result: RenderResult = { html: "<html><body>Typed</body></html>" };
void [valid, missing, wrong, props, data, control, result];

const source: ComponentSourceLocation = {
  path: "entries/screen.tsx",
  line: 1,
  column: 1,
};
const instance: ComponentInstanceRecord = {
  key: "a".repeat(64),
  id: "action",
  componentId: "typed-component",
  owner: { kind: "entry" },
  order: 0,
  props: {},
  propsKey: reviewMaterialKey({}),
  source,
};
const resolution: InstanceResolution = resolveInstance(instance, undefined);
// @ts-expect-error Invocation metadata belongs to the build runtime.
const reserved = <component.Component label="Invalid" __moklySource={source} />;
void [resolution, reserved];
