import type { ReactNode } from "react";

import { optional, useDesignInstance } from "../library/composition.js";
import {
  emptyState,
  type EmptyStateProps,
} from "../library/preview/empty-state.js";
import { flowStep } from "../library/preview/flow-step.js";

import type { DesignDestination } from "./destinations.js";

/** A catalogue destination an empty state's action or entry link may open. */
type EmptyStateDestination = NonNullable<EmptyStateProps["destination"]>;

export function FlowStep({
  children,
  name,
  description,
  number,
  screenPath,
  title,
}: {
  children: ReactNode;
  name: string;
  description: string;
  number: number;
  screenPath: DesignDestination;
  title: string;
}) {
  return (
    <flowStep.Component
      moklyInstance={useDesignInstance(name)}
      number={number}
      title={title}
      description={description}
      screenPath={screenPath}
    >
      {children}
    </flowStep.Component>
  );
}

export function EmptyState({
  body,
  code,
  linkLabel,
  links,
  title,
  to,
}: {
  body: string;
  code?: string;
  linkLabel?: string;
  /** Entry links listed below the body; one without a destination is a depiction. */
  links?: readonly { label: string; to?: EmptyStateDestination }[];
  title: string;
  to?: EmptyStateDestination;
}) {
  return (
    <emptyState.Component
      moklyInstance={useDesignInstance("empty")}
      body={body}
      title={title}
      {...optional("destination", to)}
      {...optional("actionLabel", linkLabel)}
      {...optional("code", code)}
      {...optional(
        "links",
        links?.map(({ label, to: destination }) => ({
          label,
          ...optional("destination", destination),
        })),
      )}
    />
  );
}
