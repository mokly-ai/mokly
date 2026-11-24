import { optional, useDesignInstance } from "../library/composition.js";
import { emptyState } from "../library/preview/empty-state.js";

import type { DesignDestination } from "./destinations.js";

export function EmptyState({
  body,
  code,
  linkLabel,
  title,
  to,
}: {
  body?: string;
  code?: string;
  linkLabel?: string;
  title: string;
  to: DesignDestination;
}) {
  return (
    <emptyState.Component
      moklyInstance={useDesignInstance("empty")}
      title={title}
      destination={to}
      {...optional("body", body)}
      {...optional("actionLabel", linkLabel)}
      {...optional("code", code)}
    />
  );
}

/** A loading stage or page: one busy status line, as the viewer shows it. */
export function LoadingState({ status }: { status: string }) {
  return (
    <emptyState.Component
      moklyInstance={useDesignInstance("loading")}
      body={status}
      busy
    />
  );
}
