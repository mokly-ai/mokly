/**
 * The bar of a component's saved variants above its preview: a link to each
 * variant, the shown one marked as the current page, and the change status
 * of the shown variant. A static depiction that runs no script draws a
 * variant without an address as a picture of its link.
 */

/** One saved variant of the component. */
export interface VariantBarItem {
  /** Whether the variant is the one shown. */
  current: boolean;
  /**
   * The address of the variant's page. A static depiction leaves it out for
   * a variant that it does not depict, which draws the variant as a picture.
   */
  href?: string | undefined;
  /** The variant's path, which its link carries in `data-workspace-variant`. */
  path: string;
  /** Whether the variant is removed on the branch. */
  removed: boolean;
  title: string;
}

export function VariantBar({
  status,
  variants,
}: {
  /**
   * The change status of the shown variant, such as "Card · Changed". The
   * status stays in place, hidden and empty, while the variant has none.
   */
  status?: string | undefined;
  variants: readonly VariantBarItem[];
}) {
  return (
    <nav aria-label="Saved variants" className="mbk-selection-bar">
      <span>Variant</span>
      {variants.map((variant) => {
        const label = (
          <>
            {variant.title}
            {variant.removed ? " · Removed" : ""}
          </>
        );
        return variant.href === undefined ? (
          <span
            aria-current={variant.current ? "page" : undefined}
            className="mbk-variant-option"
            data-workspace-variant={variant.path}
            key={variant.path}
          >
            {label}
          </span>
        ) : (
          <a
            aria-current={variant.current ? "page" : undefined}
            data-workspace-variant={variant.path}
            href={variant.href}
            key={variant.path}
          >
            {label}
          </a>
        );
      })}
      <span
        className="mbk-variant-status"
        data-workspace-variant-status=""
        hidden={!status}
      >
        {status ? status : null}
      </span>
    </nav>
  );
}
