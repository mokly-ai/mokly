import type { ReactNode } from "react";

import type { ApiError } from "../api/errors";
import type { Resource } from "../data/use-resource";
import { Action } from "./action";
import { ErrorDetails } from "./error-details";
import { StateMessage } from "./page-parts";

/**
 * A surface that fails to load never closes: it keeps its frame and names the
 * operation that failed, with one retry inside the pane or panel it belongs
 * to. Settings panes and viewer panels both answer a failure this way.
 */
export function PaneError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: ApiError;
  onRetry: () => void;
}) {
  return (
    <StateMessage
      title={title}
      error
      details={<ErrorDetails reference={error.requestId} />}
      action={
        <Action
          label="Try again"
          tone="primary"
          size="md"
          icon="retry"
          onPress={onRetry}
        />
      }
    />
  );
}

/** Render one loaded thing, keeping its loading and error states in place. */
export function PaneResource<T>({
  resource,
  waiting,
  failure,
  onRetry,
  children,
}: {
  resource: Resource<T>;
  /**
   * What the pane or the panel draws while its read runs: its own layout in
   * its waiting form, inside the `Pending` that names the read.
   */
  waiting: ReactNode;
  failure: string;
  onRetry: () => void;
  children: (value: T) => ReactNode;
}) {
  if (resource.status === "loading") return <>{waiting}</>;
  if (resource.status === "error") {
    return (
      <PaneError title={failure} error={resource.error} onRetry={onRetry} />
    );
  }
  return <>{children(resource.value)}</>;
}
