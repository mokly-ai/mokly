import { Action } from "../../components/action";
import { Brand } from "../../components/brand";
import { StateMessage } from "../../components/page-parts";
import { useDocumentTitle } from "../../layout/document-title";
import { dashboardPath } from "../../navigation/paths";

/** The data-free recovery shown for an address no product route owns. */
export function NotFoundScreen() {
  useDocumentTitle("Page not found");
  return (
    <div
      className="folio-root fo-recovery"
      data-mkc-screen="recovery-not-found"
    >
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
                href={dashboardPath}
                tone="primary"
              />
            }
          />
        </div>
      </main>
    </div>
  );
}
