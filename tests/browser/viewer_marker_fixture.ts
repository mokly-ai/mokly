import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

/** Inspectable top, lower-page, hidden and nested-scroll instances plus variants. */
export function markerFixture() {
  return viewerFixture('colorSchemes: ["light", "dark"],', {
    actionRender:
      '(props, context) => props.hidden ? null : <button style={{width:"50%",height:40}} data-viewport={context.viewport} disabled={props.disabled}>{props.label}</button>',
    body: '<action.Component label="Visible" /><div style={{height:850}} /><action.Component moklyInstance="lower" label="Lower" /><div style={{height:120,overflow:"auto"}} data-inner-scroll><div style={{height:180}} /><action.Component moklyInstance="nested" label="Nested" /></div><action.Component moklyInstance="hidden" label="Hidden" hidden />',
    paneVariants:
      '[{ id: "default", title: "Default", props: { children: <strong>First content</strong> } }, { id: "second", title: "Second", props: { children: <strong>Second content</strong> } }]',
  });
}
