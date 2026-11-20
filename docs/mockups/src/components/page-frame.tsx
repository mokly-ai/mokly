import { componentInput, componentMetadata } from "./metadata";

export const pageFrameInput = componentInput({
  ...componentMetadata(
    "Page frame",
    "Consistent content width and page regions.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["width"],
    properties: { width: { enum: ["content", "wide"] } },
  },
  props: { width: "content" },
  slots: ["header", "children", "footer"],
  controls: {
    width: {
      kind: "select",
      options: [
        { label: "Content", value: "content" },
        { label: "Wide", value: "wide" },
      ],
    },
  },
  render: ({ width, header, children, footer }) => (
    <div className={"page-frame frame-" + width}>
      {header}
      <div className="page-content">{children}</div>
      {footer}
    </div>
  ),
  variants: [
    {
      slug: "content",
      title: "Content",
      props: { width: "content" },
      slots: {
        children: (
          <section className="frame-sample">
            <h2>Space for your next idea</h2>
            <p>A readable home for screens and decisions.</p>
          </section>
        ),
      },
    },
    {
      slug: "wide",
      title: "Wide",
      props: { width: "wide" },
      slots: {
        children: (
          <section className="frame-sample">
            <h2>See the whole picture</h2>
            <p>Room for a screen and the conversation around it.</p>
          </section>
        ),
      },
    },
  ],
});
