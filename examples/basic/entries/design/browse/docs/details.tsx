import { MockLink } from "@mokly/mokly";

import { useDesignNavigation } from "../../parts/design_navigation.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import {
  EXAMPLE_NOTES_SOURCE,
  NAMING_GUIDE,
  WELCOME_SPECIFICATION,
} from "../../parts/docs.js";
import { DocIcon } from "../../parts/icons.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { TagChips } from "../../parts/tag_filter.js";

const RATIONALE =
  "The specification sits beside the screen it describes, so a reader can check the words against the design without leaving the catalogue.";

/**
 * The doc's own metadata. Every path is a monospace chip; the related doc is a
 * current doc's source file, so its chip is a link that opens a doc. The
 * catalogue draws one current doc at reading width, so the chip opens that
 * canonical doc design rather than a second doc artboard.
 */
export function DocDetails({ open }: { open: boolean }) {
  const navigation = useDesignNavigation();
  const doc = WELCOME_SPECIFICATION;
  return (
    <DetailsPanel open={open} destination={navigation.inspector}>
      <div className="mbk-details-body">
        <div>
          <p className="mbk-details-desc">{doc.description}</p>
          <p className="mbk-details-rationale">
            <span className="k">Why this doc — </span>
            {RATIONALE}
          </p>
        </div>
        <div className="mbk-meta">
          <MetaRow name="source" label="Source">
            <code className="mbk-code">{doc.source}</code>
          </MetaRow>
          <MetaRow name="schemes" label="Schemes">
            light, dark
          </MetaRow>
          <MetaRow name="tags" label="Tags">
            <TagChips tags={doc.tags} />
          </MetaRow>
          <MetaRow name="related-docs" label="Related docs">
            <span className="mbk-chips">
              <MockLink to={DESTINATIONS.doc} className="mbk-code doc">
                <DocIcon size={11} />
                {EXAMPLE_NOTES_SOURCE}
              </MockLink>
            </span>
          </MetaRow>
          <MetaRow name="dependencies" label="Dependencies">
            <span className="mbk-chips">
              <code className="mbk-code">{doc.source}</code>
            </span>
          </MetaRow>
        </div>
      </div>
    </DetailsPanel>
  );
}

/**
 * A removed doc's recorded details from the baseline. Its folder no longer
 * exists, so the location is text, and nothing links to a current entry.
 */
export function RemovedDocDetails() {
  const navigation = useDesignNavigation();
  const doc = NAMING_GUIDE;
  return (
    <DetailsPanel open destination={navigation.inspector}>
      <div className="mbk-details-body">
        <div>
          <p className="mbk-details-desc">{doc.description}</p>
          <p>Location: {doc.location.join(" › ")}</p>
        </div>
        <div className="mbk-meta">
          <MetaRow name="source" label="Source">
            Previous version
          </MetaRow>
          <MetaRow name="tags" label="Tags">
            <TagChips tags={doc.tags} />
          </MetaRow>
        </div>
      </div>
    </DetailsPanel>
  );
}
