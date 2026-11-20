import preview from "./.storybook/preview.js";

function UntitledButton() {
  return <button>Untitled factory</button>;
}
UntitledButton.displayName = "Untitled Factory Button";

const meta = preview.meta({ component: UntitledButton });

export const LargeButton = meta.story({});
export const Named = meta.story({ name: "Named Factory" });
