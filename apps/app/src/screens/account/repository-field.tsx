import { DropdownSelector } from "@firna/ui/dropdown";
import type { ReactNode } from "react";

import { AppLink } from "../../components/app-link";
import { ExternalLink } from "../../components/page-parts";
import { SelectorPlaceholder } from "../../components/placeholders";
import { useCompact } from "../../layout/viewport";
import {
  useAddressPathname,
  useAddressSearch,
  writeAddress,
} from "../../navigation/address";
import { paneQuery } from "../../settings/routes";
import { manageDestination, repositoryOptions } from "./repository-choices";
import type {
  ManageDestination,
  RepositoryChoices,
} from "./repository-choices";

/** The words of the manage line's link, which the waiting form draws too. */
const manage = "Manage repository access";

/**
 * The line beneath the field, which is where the list is changed: what the App
 * reads is decided on GitHub. One account's link opens that installation's own
 * page there, in a tab of its own. Several accounts' link opens the GitHub
 * accounts pane over this step, so the dialog closes back to the form as the
 * reader left it. While the accounts are read, where the link leads is not
 * known, so the line draws its words as text in the link's box.
 */
function ManageAccess({
  destination,
}: {
  destination: ManageDestination | "waiting";
}) {
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const pane = paneQuery(pathname, "github", search);
  return (
    <p className="fo-copy fo-selector-note">
      Don’t see it?{" "}
      {destination === "waiting" ? (
        <span className="fo-site-link">{manage}</span>
      ) : destination.kind === "github" ? (
        <ExternalLink to={destination.url} label={manage} />
      ) : (
        <AppLink
          href={pane}
          className="fo-site-link"
          onPress={() => writeAddress(pane, false)}
        >
          <span>{manage}</span>
        </AppLink>
      )}
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
       * beneath with its link's words as text.
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
        <ManageAccess destination="waiting" />
      </div>
    );
  const { choices, value, onChange, readOnly } = props;
  const { options, sections } = repositoryOptions(choices.accounts);
  const empty = options.length === 0 && (sections ?? []).length === 0;
  const destination = manageDestination(choices.installations);
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
      {destination && <ManageAccess destination={destination} />}
    </div>
  );
}
