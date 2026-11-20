import type { Installation } from "../../api/types";
import { Action } from "../../components/action";
import { ExternalLink, Facts } from "../../components/page-parts";
import { TextBar } from "../../components/placeholders";
import type { Resource } from "../../data/use-resource";

/**
 * The suspension, as a state of the installation rather than a failure of
 * the install step: one fact carrying the one link that clears it, above the
 * action that is still open. Resuming any one suspended account connects the
 * workspace again, so the fact links the first; the GitHub accounts pane holds
 * a link for each. The link comes from the installation list, a read of its
 * own, so while that read runs a placeholder holds the link's box, and a read
 * that failed says so where the link would be and offers it again, as the
 * Workspace pane's GitHub accounts fact does.
 */
export function Suspension({
  list,
  onRetry,
}: {
  list: Resource<Installation[]>;
  onRetry: () => void;
}) {
  const suspended =
    list.status === "ready"
      ? list.value.find((installation) => installation.state === "suspended")
      : undefined;
  return (
    <Facts
      ruled
      rows={[
        [
          "App",
          <span className="review-inline" key="installation">
            Suspended
            {list.status === "error" ? (
              <>
                <span>Couldn’t load</span>
                <Action
                  label="Try again"
                  tone="quiet"
                  size="sm"
                  icon="retry"
                  onPress={onRetry}
                />
              </>
            ) : list.status === "loading" ? (
              // The link's box takes the width; its bar fills it.
              <span
                className="fo-site-link"
                aria-hidden="true"
                style={{ width: "min(9.5em, 100%)" }}
              >
                <TextBar width="100%" />
              </span>
            ) : (
              suspended && (
                <ExternalLink
                  to={suspended.manageUrl}
                  label="Resume on GitHub"
                  newTab
                />
              )
            )}
          </span>,
        ],
      ]}
    />
  );
}
