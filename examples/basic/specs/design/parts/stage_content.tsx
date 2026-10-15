import type { ReactNode } from "react";

import { optional, useDesignInstance } from "../library/composition.js";
import { emptyState } from "../library/preview/empty-state.js";
import { flowStep } from "../library/preview/flow-step.js";

import type { DesignDestination } from "./destinations.js";

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
