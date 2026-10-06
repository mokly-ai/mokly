import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

/** Real multi-scheme documents and two variants containing inspectable instances. */
export function followupFixture() {
  return viewerFixture('colorSchemes: ["light", "dark"],', {
    body: '<div id="example-anchor"><action.Component label="Visible" /></div>',
    paneVariants:
      '[{ slug: "default", title: "Default", props: { children: <strong>First content</strong> } }, { slug: "second", title: "Second", props: { children: <strong>Second content</strong> } }]',
  });
}
