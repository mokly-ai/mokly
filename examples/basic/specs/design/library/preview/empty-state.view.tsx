import { DesignLink } from "../../parts/design_navigation.js";

import type { EmptyStateProps } from "./empty-state.js";

/** A loading state is busy and announces its body as a status. */
export function EmptyStateView({
  title,
  body,
  code,
  actionLabel,
  destination,
  busy,
}: EmptyStateProps) {
  return (
    <div className="mbk-empty" aria-busy={busy ? "true" : undefined}>
      {title ? <h2>{title}</h2> : null}
      {body || code ? (
        <p role={busy ? "status" : undefined}>
          {body}
          {code ? (
            <>
              {" "}
              <code>{code}</code>
            </>
          ) : null}
        </p>
      ) : null}
      {actionLabel ? (
        <DesignLink to={destination}>
          <span className="mbk-empty-link">{actionLabel}</span>
        </DesignLink>
      ) : null}
    </div>
  );
}
