import { browserSources } from "../../packages/viewer/tests/browser_sources.js";

import { serveCatalogue } from "./catalogue_fixture.js";

/** Native usage includes a slot, a nested component, and a hidden instance. */
export function componentExplorer(): ReturnType<typeof serveCatalogue> {
  return serveCatalogue({
    "specs/index.mockup.tsx": browserSources({
      body: '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink><MockLink to="action/disabled">Open Disabled Action</MockLink>',
      actionRender:
        "(props, context) => props.hidden ? null : <button data-viewport={context.viewport} disabled={props.disabled}>{props.label}</button>",
    }),
  });
}
