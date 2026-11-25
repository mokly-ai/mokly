import preview from "./.storybook/preview.js";

export const AHelper = { label: "Sample" };

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

const meta = preview.meta({
  title: "Factory/Helper Before",
  component: Button,
});
export const Primary = meta.story({ args: { label: "Primary" } });
