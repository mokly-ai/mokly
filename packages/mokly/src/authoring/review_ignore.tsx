import { createContext, Fragment, type ReactNode, useContext } from "react";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MATERIAL_PATTERN = /^[a-f0-9]{64}$/;
const ReviewIgnoreEnabled = createContext(true);

/** Props for one classification-only ignored region. */
export interface ReviewIgnoreProps {
  children: ReactNode;
  id: string;
  materialKey?: string;
}

/** Props for enabling or disabling markers in a render subtree. */
export interface ReviewIgnoreScopeProps {
  children: ReactNode;
  enabled: boolean;
}

/** Enable or disable Review-ignore markers for a composed subtree. */
export function ReviewIgnoreScope(props: ReviewIgnoreScopeProps) {
  return (
    <ReviewIgnoreEnabled.Provider value={props.enabled}>
      {props.children}
    </ReviewIgnoreEnabled.Provider>
  );
}

/** Mark repeated chrome without adding a layout wrapper. */
export function ReviewIgnore(props: ReviewIgnoreProps) {
  assertReviewIgnoreId(props.id, props.materialKey);
  if (!useContext(ReviewIgnoreEnabled))
    return <Fragment>{props.children}</Fragment>;
  return (
    <Fragment>
      <template data-mokly-review-ignore-start={props.id} />
      {props.children}
      <template data-mokly-review-ignore-end={props.id} />
      {props.materialKey ? (
        <template
          data-mokly-review-material={`${props.id}:${props.materialKey}`}
        />
      ) : null}
    </Fragment>
  );
}

/** Validate an ignore id and optional material key. */
export function assertReviewIgnoreId(id: string, materialKey?: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `[mokly/review-ignore] invalid id "${id}"; expected kebab-case`,
    );
  }
  if (materialKey !== undefined && !MATERIAL_PATTERN.test(materialKey)) {
    throw new Error(
      `[mokly/review-ignore] invalid material key for "${id}"; expected a sha256 key`,
    );
  }
}
