import type { Viewport } from "@mokly/mokly";

import { Brand } from "../navigation";
import { Action, StateMessage } from "../page-parts";

function NotFoundPage({ screen }: { screen: string }) {
  return (
    <div className="folio-root fo-recovery" data-mkc-screen={screen}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" className="fo-recovery-main">
        <div className="fo-recovery-body">
          <div className="fo-recovery-mark">
            <Brand />
          </div>
          <StateMessage
            title="Page not found"
            heading="h1"
            action={
              <Action
                label="Open dashboard"
                to="product/viewer/standalone"
                tone="primary"
              />
            }
          />
        </div>
      </main>
    </div>
  );
}

export function NotFoundScreen(_props: { viewport: Viewport }) {
  return <NotFoundPage screen="product/recovery/not-found" />;
}

export function NotFoundEmptyScreen(_props: { viewport: Viewport }) {
  return <NotFoundPage screen="product/recovery/not-found/empty" />;
}

export function NotFoundLoadingScreen(_props: { viewport: Viewport }) {
  return <NotFoundPage screen="product/recovery/not-found/loading" />;
}

export function NotFoundErrorScreen(_props: { viewport: Viewport }) {
  return <NotFoundPage screen="product/recovery/not-found/error" />;
}
