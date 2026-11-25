import { MockLink, definePage } from "@mokly/mokly";

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
