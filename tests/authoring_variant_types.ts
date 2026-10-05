import { defineScreen, defineComponent } from "../dist/index.js";
const fields = {
  title: "Screen",
  description: "Screen",
  dependencies: [],
  relatedDocs: [],
  mobile: "Screen",
  desktop: "Screen",
};
defineScreen({
  ...fields,
  variants: [
    {
      ...fields,
      slug: "state",
      // @ts-expect-error A fresh variant literal rejects undeclared keys.
      variantOf: "screen",
    },
  ],
});
defineScreen({
  ...fields,
  variants: [
    {
      ...fields,
      slug: "state",
      // @ts-expect-error A fresh variant literal rejects undeclared keys.
      id: "state",
    },
  ],
});
defineScreen({ ...fields, variants: [{ ...fields, slug: "state" }] });

defineScreen({
  ...fields,
  // @ts-expect-error Variants derive their paths and cannot declare an override.
  variants: [{ ...fields, slug: "state", path: "elsewhere" }],
});
defineComponent({
  title: "Component",
  description: "Component",
  dependencies: [],
  relatedDocs: [],
  propSchema: { kind: "object", properties: {} },
  render: () => null,
  variants: [
    {
      slug: "state",
      title: "State",
      props: {},
      // @ts-expect-error Component variants also have no path input.
      path: "elsewhere",
    },
  ],
});
