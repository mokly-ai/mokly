import { DesignLink } from "../../parts/design_navigation.js";
import { useDesignStyle } from "../style_context.js";

import type { EmptyStateProps } from "./empty-state.js";

export function EmptyStateView({
  title,
  body,
  code,
  actionLabel,
  destination,
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
      {actionLabel ? (
        <DesignLink to={destination}>
          <span className="mbk-empty-link">{actionLabel}</span>
        </DesignLink>
      ) : null}
    </div>
  );
}
