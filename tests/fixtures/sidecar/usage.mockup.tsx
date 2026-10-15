import { defineComponent, defineScreen, MockLink } from "@mokly/mokly";

export const leaf = defineComponent({
  title: "Leaf",
  description: "",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: { label: { type: "string" }, value: { type: "number" } },
    required: ["label"],
  },
  props: { label: "Own" },
  render: (props) => <b>{props.label}</b>,
});
export const box = defineComponent({
  title: "Box",
  description: "",
  relatedDocs: [],
  propSchema: { type: "object", additionalProperties: false },
  slots: ["children", "unused"],
  render: (props) => (
    <section>
      {props.children}
      {props.children}
    </section>
  ),
});
export const relay = defineComponent({
  title: "Relay",
  description: "",
  relatedDocs: [],
  propSchema: { type: "object", additionalProperties: false },
  slots: ["children"],
  render: (props) => (
    <box.Component unused={<leaf.Component label="Unused" />}>
      {props.children}
    </box.Component>
  ),
});
export const screen = defineScreen({
  title: "Screen",
  description: "",
  relatedDocs: [],
  render: () => (
    <main>
      <relay.Component>
        <leaf.Component label="Caller" value={-0} />
      </relay.Component>
      <MockLink to={leaf}>Leaf</MockLink>
    </main>
  ),
});
