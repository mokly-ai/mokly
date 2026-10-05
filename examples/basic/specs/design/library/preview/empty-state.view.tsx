import { DesignLink } from "../../parts/design_navigation.js";
import { useDesignStyle } from "../style_context.js";

import type { EmptyStateProps } from "./empty-state.js";

/**
 * Guidance on an empty stage, with an optional action and an optional list of
 * entry links. A link without a destination stays a depiction.
 */
export function EmptyStateView({
  title,
  body,
  code,
  actionLabel,
  destination,
  links,
}: EmptyStateProps) {
  useDesignStyle("empty-state");
  return (
    <div className="mbk-empty">
      <h2>{title}</h2>
      <p>
        {body}
        {code ? (
          <>
            {" "}
            <code>{code}</code>
          </>
        ) : null}
      </p>
      {links && links.length > 0 ? (
        <ul className="mbk-empty-links">
          {links.map((link) => (
            <li key={link.label}>
              <DesignLink to={link.destination}>
                <span className="mbk-empty-link">{link.label}</span>
              </DesignLink>
            </li>
          ))}
        </ul>
      ) : null}
      {actionLabel ? (
        <DesignLink to={destination}>
          <span className="mbk-empty-link">{actionLabel}</span>
        </DesignLink>
      ) : null}
    </div>
  );
}
