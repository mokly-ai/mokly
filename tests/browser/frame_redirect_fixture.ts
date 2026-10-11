import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** Real static redirects around the public viewer and its compiled component documents. */
export async function frameRedirectFixture() {
  const fixture = await viewerFixture("", {
    body: '<div style={{width:200,height:70,overflow:"hidden"}}><action.Component label="Styled action" /></div>',
    actionRender:
      'props => <button id="position" style={{background:"rgb(64, 32, 128)",color:"white",width:240,height:48}}>{props.label}</button>',
    extra: 'import { definePage } from "@mokly/mokly";',
    exports:
      '...action.entries, ...pane.entries, definePage({path:"guide",title:"Guide",description:"Index document",relatedDocs:[],render:()=>"<!doctype html><html><head><title>Guide</title></head><body><p>Directory page</p></body></html>"}),',
  });
  try {
    const redirected = await serveStaticFiles(fixture.root, {
      redirectHtml: true,
    });
    return {
      ...fixture,
      redirected,
      async close() {
        await redirected.close();
        await fixture.close();
      },
    };
  } catch (error) {
    await fixture.close();
    throw error;
  }
}
