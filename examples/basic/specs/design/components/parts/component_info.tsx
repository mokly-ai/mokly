import { MetaRow } from "../../parts/metadata_row.js";

import { COMPONENTS, type ComponentEntryMetadata } from "./metadata.js";

/**
 * The shown entry's Details: its description, then its path and source as
 * secondary lines, with references behind a native disclosure. A removed entry
 * adds its location only when it was inside a folder.
 */
export function ComponentInfo({ entry }: { entry: ComponentEntryMetadata }) {
  const component = COMPONENTS[entry.component];
  return (
    <section>
      <h3>About {entry.title}</h3>
      <p>{component.description}</p>
      <p className="ce-muted">
        Path <code>{entry.path}</code>
      </p>
      <p className="ce-muted">
        Source <code>{component.source}</code>
      </p>
      {entry.location && entry.location.length > 0 ? (
        <p className="ce-muted">Location {entry.location.join(" › ")}</p>
      ) : null}
      <details className="ce-slot-details">
        <summary>Source and references</summary>
        <dl className="ce-props">
          {entry.variantOf ? (
            <MetaRow name="variant-of" label="Variant of" presentation="props">
              {COMPONENTS[entry.variantOf].title}
            </MetaRow>
          ) : null}
          <MetaRow name="schemes" label="Schemes" presentation="props">
            Light, Dark
          </MetaRow>
          <MetaRow name="tags" label="Tags" presentation="props">
            Components
          </MetaRow>
          <MetaRow
            name="related-docs"
            label="Related docs"
            presentation="props"
          >
            Component guide
          </MetaRow>
          <MetaRow
            name="dependencies"
            label="Dependencies"
            presentation="props"
          >
            {component.dependencies.map((dependency) => (
              <code key={dependency}>{dependency}</code>
            ))}
          </MetaRow>
        </dl>
      </details>
    </section>
  );
}
