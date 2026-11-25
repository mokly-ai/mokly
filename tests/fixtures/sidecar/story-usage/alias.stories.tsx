import { Button } from "./controls.js";

export default { title: "Button alias", component: Button };

export function Legacy({ label }: { label: string }) {
  return <Button label={label} />;
}

Legacy.args = { label: "Alias" };
