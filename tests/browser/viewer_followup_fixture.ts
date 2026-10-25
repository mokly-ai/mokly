import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

/** Real multi-scheme documents and two variants containing inspectable instances. */
export function followupFixture(
  screenVariants?: string,
): ReturnType<typeof viewerFixture> {
  return viewerFixture({
    ...(screenVariants ? { screenVariants } : {}),
    body: '<div id="example-anchor"><action.Component label="Visible" /></div>',
    paneVariants:
      '[{ slug: "default", title: "Default", props: {}, slots: { children: <strong>First content</strong> } }, { slug: "second", title: "Second", props: {}, slots: { children: <strong>Second content</strong> } }]',
  });
}
