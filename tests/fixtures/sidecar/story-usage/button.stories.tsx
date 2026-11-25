import { Button, ForwardField } from "./controls.js";

export default { title: "Button", component: Button };

export const Default = {
  args: { label: "Own" },
  render: ({ label }: { label: string }) => (
    <>
      <Button label={label} />
      <ForwardField key="related" label="Related" />
    </>
  ),
};

export const Variant = { ...Default, args: { label: "Variant" } };
