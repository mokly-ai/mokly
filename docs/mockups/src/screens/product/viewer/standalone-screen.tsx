import { MockLink } from "@mokly/mokly";
import type { Viewport } from "@mokly/mokly";

import { CatalogueLinks } from "../../../components/catalogue-links";
import { sample } from "../../../fixtures/product";
import { denseViewerChrome } from "../../../fixtures/product-states";

import {
  StageFailed,
  StageWorkspaceUnreadable,
  StageUnreadable,
} from "./stage";
import {
  StageAccessBlocked,
  StageAccessRefused,
  StageOpening,
} from "./stage-access";
import { StandalonePage, failedMeta } from "./standalone-page";
import {
  StagePlanRequired,
  StagePlanRequiredReader,
  StageUnpublishedReader,
} from "./unpublished-stage";

export function ViewerStandaloneScreen({ viewport }: { viewport: Viewport }) {
  return <StandalonePage viewport={viewport} state="default" />;
}

export function ViewerStandaloneEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <StandalonePage viewport={viewport} state="empty" />;
}

export function ViewerStandaloneLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <StandalonePage viewport={viewport} state="loading" />;
}

export function ViewerStandaloneErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <>
      <StandalonePage viewport={viewport} state="error" />
      <CatalogueLinks>
        <MockLink to="product/viewer/standalone/version">
          Viewer version failure
        </MockLink>
      </CatalogueLinks>
    </>
  );
}

/**
 * The bar naming a reader who has not set a display name, which is every
 * account until somebody does. The long workspace name and address prove
 * that desktop truncation keeps every action on one row; the compact bar keeps
 * the address's local part. Both retain their complete accessible names.
 */
export function ViewerStandaloneAccountScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  const email = denseViewerChrome.email;
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/account"
      workspace={denseViewerChrome.workspace}
      project={sample.project}
      account={
        viewport === "mobile"
          ? { label: email.split("@")[0] ?? email, whole: email }
          : { label: email, whole: email }
      }
    />
  );
}

/**
 * The read that would have produced the publication failed. The address named
 * one, so the stage says so rather than naming the project; the chrome has no
 * reference to show, because resolving it is what did not happen.
 */
export function ViewerStandaloneUnreadableScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="error"
      screen="product/viewer/standalone/unreadable"
      reference="This project"
      publicationMeta={{ state: "none", detail: "Not published" }}
      stage={<StageUnreadable />}
    />
  );
}

/** A publication that never arrived, opened as the details it does have. */
export function ViewerStandaloneFailedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="error"
      screen="product/viewer/standalone/failed"
      publicationMeta={failedMeta}
      stage={<StageFailed />}
    />
  );
}

/**
 * A newer publication has arrived on the branch the reader is inside. They stay
 * where they are until they say otherwise, because moving a reader off the
 * publication they are studying loses their place in it, so the chrome offers
 * the way there and nothing moves on its own.
 */
export function ViewerStandaloneLatestScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/latest"
      latest
    />
  );
}

/**
 * The three answers the publication's own host can give before its catalogue
 * mounts. A ready publication is still behind the host's own credential, so
 * the chrome stays and the stage says where the reader stands.
 */
export function ViewerStandaloneCatalogueScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/catalogue"
      stage={<StageAccessBlocked />}
    />
  );
}

/** The exchange with the publication's host, while it is still in flight. */
export function ViewerStandaloneCatalogueLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/catalogue/loading"
      stage={<StageOpening />}
    />
  );
}

/** The host refused the credential, which another press can still fix. */
export function ViewerStandaloneCatalogueErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/catalogue/error"
      stage={<StageAccessRefused />}
    />
  );
}

/** A private comparison failure with the current catalogue as its fallback. */
export function ViewerStandaloneComparisonScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/catalogue/comparison"
      comparisonBlocked
    />
  );
}

/** The unpublished branch as a reader who cannot publish it sees it. */
export function ViewerStandaloneReaderScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/reader"
      unpublished={<StageUnpublishedReader />}
    />
  );
}

/** The same branch in a private project the free plan publishes nothing to. */
export function ViewerStandalonePlanScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/plan"
      unpublished={<StagePlanRequired />}
    />
  );
}

/** The same project read by everyone who cannot open billing themselves. */
export function ViewerStandalonePlanReaderScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/plan-reader"
      unpublished={<StagePlanRequiredReader />}
    />
  );
}

/**
 * The same private project while its workspace ownership cannot be read.
 * The project capability already refused publishing; the ownership read only
 * decides whether this reader can open Billing. The stage names the failed
 * read and keeps the switcher the chrome already holds.
 */
export function ViewerStandaloneWorkspaceUnreadableScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="error"
      screen="product/viewer/standalone/workspace-unreadable"
      publicationMeta={{ state: "none", detail: "Not published" }}
      stage={<StageWorkspaceUnreadable />}
    />
  );
}
