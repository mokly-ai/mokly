import { MetaRow } from "../../parts/metadata_row.js";
export function PropValues({
  disabled = false,
  label = "Continue",
}: {
  disabled?: boolean;
  label?: string;
}) {
  return (
    <dl className="ce-props" aria-label="Supplied props">
      <MetaRow name="label" label="label" presentation="props">
        <code>"{label}"</code>
      </MetaRow>
      <MetaRow name="disabled" label="disabled" presentation="props">
        <code>{String(disabled)}</code>
      </MetaRow>
    </dl>
  );
}
