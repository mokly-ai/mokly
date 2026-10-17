import { serveCatalogue } from "./catalogue_fixture.js";
export type NavigationFixture = Awaited<ReturnType<typeof serveCatalogue>>;
export function startNavigationFixture(): Promise<NavigationFixture> {
  return serveCatalogue(
    {
      "specs/index.mockup.tsx": `import {defineScreen, defineUseCase, definePage, MockLink} from "@mokly/mokly";
import React from "react";
const metadata = {relatedDocs: []};
function Home({ compact }) {
  const nestedGenerated = compact ? "../details/index.mobile.html" : "../details/index.desktop.html";
  return <main id="home">
    <img alt="" src={compact ? "../../../../slow-navigation-mobile.svg" : "../../../../slow-navigation-desktop.svg"} />
    {compact ? <MockLink fragment="section" id="mock-link" to="fixture/nested/details">MockLink details</MockLink> : <a href="mock:fixture/nested/details#section" id="raw-link">Raw details</a>}
    <map name="destinations"><area href="mock:fixture/nested/details#section" id="area-link" shape="default" /></map>
    <svg viewBox="0 0 100 30"><a href="mock:fixture/nested/details#section" id="svg-link"><text x="0" y="20">SVG details</text></a></svg>
    <a href="mock:fixture/nested/details#section" id="blank-link" target="_blank">Blank details</a>
    <a href="mock:fixture/nested/details#section" id="named-link" target="DetailsFrame">Named details</a>
    <a href="mock:fixture/nested/details#section" id="top-link" target="_top">Top details</a>
    <a href="mock:fixture/nested/details#section" id="parent-link" target="_parent">Parent details</a>
    <a href="../details/index.mobile.html" id="unowned-details-link">Unowned details</a>
    <a href="./index.mobile.dark.html" id="unowned-next-scheme-link">Unowned next scheme</a>
    <a href="#home" id="unmarked-top" target="_top">Ordinary top</a>
    <a href="#home" id="unmarked-parent" target="_parent">Ordinary parent</a>
    <svg viewBox="0 0 100 30"><a href="#home" id="unmarked-svg-top" target="_top"><text x="0" y="20">Ordinary SVG</text></a></svg>
    <a href="https://cross-origin.example.test/nested.html" id="external-self">External</a>
    <a download="fixture.txt" href="../../../../fixture.txt" id="download-top" target="_top">Download</a>
    <form action="#home" id="top-form" target="_top"><button type="submit">Submit</button></form>
    <script>window.__consumerScriptRan = true;</script>
    <iframe id="srcdoc-nested" srcDoc={'<a data-mokly-link="fixture/nested/details#section" href="../details/index.mobile.html" id="srcdoc-marked" target="_top">Marked</a><a href="#ordinary" id="srcdoc-unmarked" target="_top">Ordinary</a><a href="#popup" id="srcdoc-popup" target="_blank">Popup</a><script>parent.__nestedScriptRan=true</script>'} title="srcdoc nested" />
    <iframe id="local-nested" src="../../../../fixture/nested/home/nested.html" title="local nested" />
    <iframe id="generated-nested" src={nestedGenerated} title="generated nested" />
    <iframe id="cross-nested" src="https://cross-origin.example.test/nested.html" title="cross-origin nested" />
  </main>;
}
function Details() {
  return <main id="section"><h1>Details destination</h1><a href="mock:fixture/nested/home" id="return-link">Return home</a><a href="mock:other/extra" id="extra-link">Extra</a></main>;
}

export const home = defineScreen({...metadata, description: "Home", path: "fixture/nested/home", title: "Home", props: {state: "home"}, render: (props, context) => props.state === "home" ? <Home compact={context.viewport === "mobile"}/> : <main id={"home-"+props.state}>{props.state === "empty" ? "Empty workspace" : "Save failed"}</main>, useCasePaths: ["fixture/nested/tour"], variants: [{slug: "empty", title: "Empty workspace", props: {state: "empty"}}, {slug: "error", title: "Save failed", props: {state: "error"}}]});
export const details = defineScreen({...metadata, description: "Details", path: "fixture/nested/details", title: "Details", props: {}, render: () => <Details/>, useCasePaths: ["fixture/nested/tour"]});
export const extra = defineScreen({...metadata, description: "Extra", path: "other/extra", title: "Extra", props: {}, render: () => <main>Extra</main>});
export const tour = defineUseCase({...metadata, description: "Tour", path: "fixture/nested/tour", title: "Tour", steps: [{screenPath: "fixture/nested/home"}, {screenPath: "fixture/nested/details"}]});
export const guide = definePage({...metadata, description: "Guide", path: "guide", title: "Guide", render: () => '<!doctype html><html><head><title>Guide</title></head><body><a id="legacy-link" href="mock:fixture/nested/details#section">Details</a></body></html>'});
`,
      "fixture/nested/home/nested.html":
        '<!doctype html><html><head><base target="_top"></head><body><div id="local"></div><a id="local-base" href="#local">Base-targeted</a><a id="local-unmarked" href="#local" target="_top">Local</a><a data-mokly-link="fixture/nested/details" href="../../../mokly-generated/fixture/nested/details/index.mobile.html" id="local-marked" target="_top">Marked-looking</a></body></html>',
      "fixture.txt": "fixture",
      "slow-navigation-mobile.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      "slow-navigation-desktop.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
    },
    { colorSchemes: ["light", "dark"] },
  );
}
