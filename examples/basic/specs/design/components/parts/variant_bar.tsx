import { MockLink } from "@mokly/mokly";

/** One entry of a component page's variant bar. */
export interface VariantBarOption {
  label: string;
  /** The artboard that shows this entry; an option without one is not linked. */
  to?: string;
  current?: boolean;
}

/**
 * The parent's own entry first, then each saved variant in authored order,
 * with the shown entry marked. The shown entry links to its own artboard.
 */
export function VariantBar({
  options,
}: {
  options: readonly VariantBarOption[];
}) {
  return (
    <nav className="ce-variants" aria-label="Saved variants">
      <span>Variant</span>
      {options.map((option) =>
        option.to ? (
          <MockLink
            key={option.label}
            to={option.to}
            aria-current={option.current ? "page" : undefined}
          >
            {option.label}
          </MockLink>
        ) : (
          <span className="ce-variant-option" key={option.label}>
            {option.label}
          </span>
        ),
      )}
    </nav>
  );
}
