import { DropdownSelector } from "@firna/ui/dropdown";
import type { ReactNode } from "react";

import { AppLink } from "../../components/app-link";
import { SelectorPlaceholder } from "../../components/placeholders";
import { useCompact } from "../../layout/viewport";
import {
  useAddressPathname,
  useAddressSearch,
  writeAddress,
} from "../../navigation/address";
import { paneQuery } from "../../settings/routes";

import { repositoryOptions } from "./repository-choices";
import type { RepositoryChoices } from "./repository-choices";

/**
 * The line beneath the field, which is where the list is changed: what the App
 * reads is decided on GitHub, one account at a time. The link opens the GitHub
 * accounts pane over this step, however many accounts the workspace connects,
 * because that pane is where accounts are added and managed. On a desktop the dialog closes back to the form as the reader
 * left it; on a phone the pane is its own route, and the form starts again.
 */
function ManageAccess() {
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const pane = paneQuery(pathname, "github", search);
  return (
    <p className="fo-copy fo-selector-note">
      Don’t see it?{" "}
      <AppLink
        href={pane}
        className="fo-site-link"
        onPress={() => writeAddress(pane, false)}
      >
        <span>Manage repository access</span>
      </AppLink>
    </p>
  );
}

/** What the field draws: the repositories to choose from, or its waiting form. */
type RepositoryFieldProps =
  | {
      choices: RepositoryChoices;
      value: string;
      onChange: (repositoryId: string) => void;
      readOnly: boolean;
      waiting?: false;
    }
  | {
      /**
       * The waiting form while the repositories are read: the select's own
       * trigger, read only, holding `hold`, the read's name, and the line
       * beneath, whose link needs nothing from the read.
       */
      waiting: true;
      hold?: ReactNode;
    };

/**
 * The one field for the repository and the one line beneath it. A workspace
 * with several connected accounts groups the select by account; one account
 * keeps it flat. With nothing to choose the field is disabled over its
 * placeholder and the line is the way on.
 */
export function RepositoryField(props: RepositoryFieldProps) {
  const compact = useCompact();
  if (props.waiting)
    return (
      <div className="fo-account-selector">
        <SelectorPlaceholder label="Repository" hold={props.hold} />
        <ManageAccess />
      </div>
    );
  const { choices, value, onChange, readOnly } = props;
  const { options, sections } = repositoryOptions(choices.accounts);
  const empty = options.length === 0 && (sections ?? []).length === 0;
  return (
    <div className="fo-account-selector">
      <DropdownSelector
        label="Repository"
        // The trigger carries the chosen repository, so its composed name
        // would change with the value; naming it once keeps the control the
        // same control however the reader has answered it.
        triggerLabel="Repository"
        value={value}
        placeholder={empty ? "No repositories yet" : "Choose a repository"}
        options={options}
        sections={sections}
        variant="field"
        size={compact ? "lg" : "md"}
        searchable
        readOnly={empty || readOnly}
        onValueChange={onChange}
        testID="repository-select"
      />
      <ManageAccess />
    </div>
  );
}
