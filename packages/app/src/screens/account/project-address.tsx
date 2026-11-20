import type { ReactNode } from "react";

import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Field } from "../../components/field";
import {
  AddressPreview,
  Pending,
  StateMessage,
} from "../../components/page-parts";
import { TextBar } from "../../components/placeholders";
import type { useSuggestedSlug } from "../../data/use-slug-suggestion";
import { projectPath, workspacePath } from "../../navigation/paths";

/** The suggestion-backed slug field, as `useSuggestedSlug` drives it. */
export type SuggestedSlug = ReturnType<typeof useSuggestedSlug>;

/** The slug field, named once for the form and for its waiting form. */
const slugField = {
  label: "Project slug",
  name: "project-slug",
  type: "identifier",
} as const;

/** What the slug and its address draw: the form's own, or its waiting form. */
type ProjectAddressProps =
  | {
      workspaceSlug: string;
      suggestion: SuggestedSlug;
      disabled: boolean;
      /** What the slug field owns of a refused creation. */
      error?: string;
      waiting?: false;
    }
  | {
      /**
       * The waiting form while a read of the form runs: the field in its own
       * waiting form, and the address line holding a bar, or `hold`, the read's
       * name, where the address is the place that names it.
       */
      waiting: true;
      hold?: ReactNode;
    };

/**
 * The new project's slug and the address it gives, for both forms that make
 * a project. The slug is suggested from the repository and the config path
 * and stays the reader's to edit. While the suggestion is on its way, the
 * address line names it in place of the address and the form inserts nothing;
 * a suggestion that could not be read offers the read again. Neither replaces
 * what the reader typed themselves.
 */
export function ProjectAddress(props: ProjectAddressProps) {
  if (props.waiting)
    return (
      <>
        <Field {...slugField} waiting />
        <AddressPreview
          hold={props.hold ?? <TextBar width="min(16em, 100%)" />}
        />
      </>
    );
  const { workspaceSlug, suggestion, disabled, error } = props;
  const slug = suggestion.value;
  return (
    <>
      <Field
        {...slugField}
        value={slug}
        onChange={suggestion.edit}
        onFocus={suggestion.focus}
        onBlur={suggestion.blur}
        disabled={disabled}
        error={error}
      />
      {suggestion.state.status === "loading" && !suggestion.edited ? (
        <Pending label="Finding an available address">
          {(held) => <AddressPreview hold={held} />}
        </Pending>
      ) : (
        <AddressPreview
          path={
            slug
              ? projectPath(workspaceSlug, slug)
              : `${workspacePath(workspaceSlug)}/`
          }
        />
      )}
      {suggestion.state.status === "error" && !suggestion.edited && (
        <StateMessage
          title="Address couldn’t load"
          error
          details={
            <ErrorDetails reference={suggestion.state.error.requestId} />
          }
          action={
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              onPress={suggestion.reload}
            />
          }
        />
      )}
    </>
  );
}
