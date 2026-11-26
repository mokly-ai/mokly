import { MockLink, definePage } from "@mokly/mokly";

import { badge } from "./component.mockup.js";

export default { title: "Render failures" };

const unregistered = definePage({
  title: "Unregistered",
  description: "A link target outside the catalogue.",
  relatedDocs: [],
  render: () => "<p>Unregistered</p>",
});

export const Working = { render: () => <button>Ready</button> };

export const ReservedMarker = {
  render: () => <template data-mokly-boundary="forged" />,
};

export const UnknownLink = {
  render: () => <MockLink to={unregistered}>Missing</MockLink>,
};

export const DuplicateInstance = {
  render: () => (
    <>
      <badge.Component moklyInstance="same" label="First" />
      <badge.Component moklyInstance="same" label="Second" />
    </>
  ),
};

export const NonDataProp = {
  render: () => (
    // @ts-expect-error Supply a function to exercise render-time validation.
    <badge.Component label={() => "Invalid"} />
  ),
};

export const ComponentError = {
  render: () => <badge.Component label="Fail" />,
};

export const Message = {
  args: { text: "Reason" },
  render({ text }: { text: string }) {
    throw new Error(text);
  },
};

export const NullPrototype = {
  render() {
    throw Object.create(null);
  },
};

export const NonStringMessage = {
  render() {
    throw Object.defineProperty(new Error(), "message", {
      value: Object.create(null),
    });
  },
};

export const LoneSurrogate = {
  render() {
    throw new Error("Invalid \ud800 text");
  },
};
